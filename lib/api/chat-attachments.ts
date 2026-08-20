import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** One option's tally on a poll attachment, pre-hydration. */
export interface PollVote {
  count: number;
  mine: boolean;
  voterIds?: string[];
}

export interface ChatAttachment {
  type: string;
  path?: string;
  size?: number;
  duration?: number;
  url?: string;
  /** B7 — display filename, "file"-type attachments only. */
  name?: string;
  /** B7 — the shared profile's id, "contact"-type attachments only. */
  userId?: string;
  /** B7 — "poll"-type only: question text, options, and per-option tallies. */
  question?: string;
  options?: string[];
  votes?: unknown[];
  /** B7 — "event"-type only: an info card, no RSVP/attendance state. */
  title?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  note?: string;
  /** B7 — "location"-type only: a precise device-GPS pin, never fuzzed. */
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

/**
 * Resolve fresh signed URLs for every attachment that carries a storage `path`.
 * Requires the ADMIN client: chat-attachments' storage RLS is owner-path-scoped
 * only (see the storage_buckets migration), so another participant's actor
 * client can never sign a sender's object directly — the API mediates
 * cross-participant reads here, by design. Never persist the returned `url`;
 * it expires, `path` doesn't.
 *
 * A listen-once message (`m.listenOnce`) never gets a URL here, played or
 * not — the whole point is the API is the only thing that can mint one, and
 * only through the dedicated one-shot voice-url endpoint. Callers must map
 * `listen_once` onto `listenOnce` before passing messages in.
 */
export async function signAttachmentsForMessages<
  T extends { attachments?: ChatAttachment[] | null; listenOnce?: boolean }
>(admin: SupabaseClient, messages: T[]): Promise<T[]> {
  const allPaths = [
    ...new Set(
      messages
        .filter((m) => !m.listenOnce)
        .flatMap((m) => (m.attachments ?? []).filter((a) => a?.path).map((a) => a.path as string))
    ),
  ];
  const { data } = allPaths.length
    ? await admin.storage.from(CHAT_ATTACHMENTS_BUCKET).createSignedUrls(allPaths, SIGNED_URL_TTL_SECONDS)
    : { data: [] as { path: string; signedUrl: string }[] };
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return messages.map((m) => ({
    ...m,
    attachments: (m.attachments ?? []).map((a) =>
      a?.path ? { ...a, url: m.listenOnce ? null : urlByPath.get(a.path) ?? null } : a
    ),
  }));
}

/** Same as [signAttachmentsForMessages] for a single message's attachment list. */
export async function signAttachments(
  admin: SupabaseClient,
  attachments: ChatAttachment[] | null | undefined,
  listenOnce = false
): Promise<ChatAttachment[]> {
  const [signed] = await signAttachmentsForMessages(admin, [{ attachments, listenOnce }]);
  return signed.attachments ?? [];
}

/**
 * B7 — fill in the display fields of every `contact` attachment (a shared
 * TripOtter profile) across [messages], in ONE query for the whole page.
 *
 * Only `userId` is ever persisted for a contact; username/name/image are
 * resolved per-request here and never written back — exactly the same
 * reasoning as `url` vs `path` above. A snapshot of someone's name and
 * avatar taken at send time goes stale the moment they change either, and a
 * months-old thread would keep showing the wrong person; the id doesn't rot.
 *
 * Batched deliberately (one `in` query, not per-attachment) to keep the DM
 * speed program's Step A3 waterfall-collapse property intact.
 *
 * `profiles` is world-readable (`profiles_select_all`), so this needs no
 * admin escalation — but it takes whatever client the caller already has.
 * A profile that no longer exists resolves to nothing and the client renders
 * its own fallback, rather than failing the whole message fetch.
 */
export async function hydrateContactAttachments<
  T extends { attachments?: ChatAttachment[] | null }
>(db: SupabaseClient, messages: T[]): Promise<T[]> {
  // Both a shared contact and a poll's voters resolve to profiles, so they
  // share ONE query rather than stacking two round trips — same batching
  // discipline Step A3 established for the rest of this route.
  const ids = [
    ...new Set(
      messages.flatMap((m) =>
        (m.attachments ?? []).flatMap((a) => {
          if (a?.type === "contact" && typeof a.userId === "string") return [a.userId];
          if (a?.type === "poll" && Array.isArray(a.votes)) {
            return (a.votes as PollVote[]).flatMap((v) => v?.voterIds ?? []);
          }
          return [];
        })
      )
    ),
  ];
  if (!ids.length) return messages;

  const { data } = await db
    .from("profiles")
    .select("id, username, full_name, profile_image")
    .in("id", ids);
  const byId = new Map((data ?? []).map((p: Record<string, any>) => [p.id, p]));
  const voterOf = (uid: string) => {
    const p = byId.get(uid);
    return p
      ? { id: p.id, name: p.full_name, username: p.username, image: p.profile_image }
      : { id: uid };
  };

  return messages.map((m) => ({
    ...m,
    attachments: (m.attachments ?? []).map((a) => {
      if (a?.type === "contact" && typeof a.userId === "string") {
        const p = byId.get(a.userId);
        return p
          ? { ...a, username: p.username, name: p.full_name, image: p.profile_image }
          : a;
      }
      if (a?.type === "poll" && Array.isArray(a.votes)) {
        return {
          ...a,
          // Swap raw ids for renderable voters; drop voterIds so the client
          // isn't handed two representations of the same thing.
          votes: (a.votes as PollVote[]).map(({ voterIds, ...v }) => ({
            ...v,
            voters: (voterIds ?? []).map(voterOf),
          })),
        };
      }
      return a;
    }),
  }));
}

/**
 * The single entry point every chat read path should use: resolves the
 * ephemeral parts of every attachment type (storage signed URLs + contact
 * profile fields). Exists so a new read path can't quietly forget one of
 * them — the failure mode would be a silently half-rendered bubble.
 */
export async function resolveAttachmentsForMessages<
  T extends { attachments?: ChatAttachment[] | null; listenOnce?: boolean }
>(admin: SupabaseClient, messages: T[]): Promise<T[]> {
  return hydrateContactAttachments(admin, await signAttachmentsForMessages(admin, messages));
}

export const EXPIRED_VOICE_TEXT = "[voice message expired]";

/**
 * Lazy purge (the primary TTL mechanism — see the pg_cron migration for the
 * DB-only backstop): among raw `messages` rows, sweep any that are either
 * past `expires_at` OR a listen-once voice note that's already been played
 * (`listen_once && voice_played_at`, set atomically by the voice-url consume
 * endpoint — see `app/api/chat/conversations/[id]/messages/[messageId]/
 * voice-url/route.ts`). Both share the same fate: delete the voice
 * attachment's storage blob and strip content/attachments — reusing this one
 * path rather than a parallel scrub for listen-once, per the V2 design.
 * Requires the ADMIN client for both the storage delete and the messages
 * UPDATE — RLS only lets a message's own sender update it, but any
 * participant reading the thread should trigger this purge. Mutates [rows]
 * in place so the caller can map them without a second round trip. Callers
 * must select `listen_once` and `voice_played_at` alongside `expires_at` for
 * this to see listen-once rows at all.
 */
export async function purgeExpiredVoiceRows(
  admin: SupabaseClient,
  rows: Array<Record<string, any>>
): Promise<void> {
  await persistExpiredVoicePurge(admin, maskExpiredVoiceRows(rows));
}

/** What [maskExpiredVoiceRows] found: the message ids to strip and the blobs to drop. */
export interface ExpiredVoicePurge {
  ids: string[];
  paths: string[];
}

/**
 * The **synchronous half** of the purge: mask expired rows in memory so the
 * response never exposes stale content, and return what needs persisting. No IO
 * — safe to call on a read's critical path.
 *
 * Split out of [purgeExpiredVoiceRows] for the DM speed program (Step A3): the
 * inbox is a GET that was blocking on an admin-client *write* before it could
 * respond. Masking is what the response actually needs; persisting is
 * bookkeeping, and now runs after the response is sent (see the conversations
 * route's `after()`), on the next thread open, or on a pg_cron tick.
 *
 * Collects the storage paths **before** clearing `attachments` — the two must
 * not be reordered, which is exactly why they live in one function rather than
 * as two steps a caller could get wrong.
 */
export function maskExpiredVoiceRows(
  rows: Array<Record<string, any>>
): ExpiredVoicePurge {
  const now = Date.now();
  const expired = rows.filter(
    (r) =>
      r.content !== EXPIRED_VOICE_TEXT &&
      ((r.expires_at && new Date(r.expires_at).getTime() < now) ||
        (r.listen_once && r.voice_played_at))
  );
  const ids: string[] = [];
  const paths: string[] = [];
  for (const r of expired) {
    ids.push(r.id as string);
    for (const a of (r.attachments ?? []) as ChatAttachment[]) {
      if (a?.path) paths.push(a.path);
    }
    r.content = EXPIRED_VOICE_TEXT;
    r.attachments = [];
  }
  return { ids, paths };
}

/**
 * The **IO half**: drop the storage blobs and strip the rows in the DB. Needs the
 * ADMIN client (RLS only lets a message's own sender update it, but any
 * participant reading the thread should trigger the purge). Safe to call with an
 * empty purge, and safe to run after the response has been sent.
 */
export async function persistExpiredVoicePurge(
  admin: SupabaseClient,
  purge: ExpiredVoicePurge
): Promise<void> {
  if (!purge.ids.length) return;
  if (purge.paths.length) {
    await admin.storage.from(CHAT_ATTACHMENTS_BUCKET).remove(purge.paths);
  }
  await admin
    .from("messages")
    .update({ content: EXPIRED_VOICE_TEXT, attachments: [] })
    .in("id", purge.ids);
}
