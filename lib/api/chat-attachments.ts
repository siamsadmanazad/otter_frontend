import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface ChatAttachment {
  type: string;
  path?: string;
  size?: number;
  duration?: number;
  url?: string;
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
