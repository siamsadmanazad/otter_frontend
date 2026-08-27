import { NextRequest, after } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import {
  hydrateContactAttachments,
  signAttachments,
  resolveAttachmentsForMessages,
  purgeExpiredVoiceRows,
  maskExpiredVoiceRows,
  persistExpiredVoicePurge,
} from "@/lib/api/chat-attachments";
import {
  isBlockedInConversation,
  isParticipant,
  getDirectPeerId,
} from "@/lib/api/chat-guards";
import { captureRouteError } from "@/lib/observability";
import { createStageTimer } from "@/lib/api/timing";

const VOICE_TTL_MS = 24 * 60 * 60 * 1000;

// Attachments come in two shapes: STORAGE-backed ones identified by a bucket
// `path`, and REFERENCE ones that point at another row by id and carry no blob
// at all (B7's shared-profile "contact"). They validate differently, so the
// sets are kept apart rather than special-cased inside one predicate.
const STORAGE_ATTACHMENT_TYPES = new Set(["image", "video", "voice", "file"]);
const REFERENCE_ATTACHMENT_TYPES = new Set(["contact"]);
// A third shape: SELF-CONTAINED content that is neither a blob nor a pointer.
// A poll's question/options (and an event's title/time/location) are
// immutable message content, so they live in the jsonb itself. Poll's votes
// are the one piece of *mutable* state and get their own table; an event (per
// OStad's 2026-08-19 scope call — an info card with an "add to calendar"
// action, not an in-app RSVP) has no mutable half at all, so it needs nothing
// beyond this branch. If RSVP tracking gets added later, it follows poll's
// exact split: the card stays here, attendance gets a table.
// "location" (B7, OStad's 2026-08-20 scope call for V1/launch): a precise
// device-GPS pin, NOT fuzzed like Radar — a DM is a deliberate 1:1 share to
// someone already in the conversation, a different privacy act than
// appearing to nearby strangers (see the Contact step's identical reasoning,
// `[[radar-phase3-progress]]`/`[[radar-phase7-scope]]`). No place search/pin
// drop and no static-map preview in V1 — both need a new Google API key +
// billing this close to launch; "Open in Maps" is a plain
// google.com/maps?q=lat,lng link instead, which needs nothing new.
const CONTENT_ATTACHMENT_TYPES = new Set(["poll", "event", "location"]);
const MAX_ATTACHMENTS_PER_MESSAGE = 1;
const MAX_FILE_NAME_LENGTH = 150;
const MAX_POLL_QUESTION_LENGTH = 200;
const MAX_POLL_OPTION_LENGTH = 80;
const MAX_POLL_OPTIONS = 10; // keep in sync with the migration's option_index CHECK
const MIN_POLL_OPTIONS = 2;
const MAX_EVENT_TITLE_LENGTH = 150;
const MAX_EVENT_LOCATION_LENGTH = 200;
const MAX_EVENT_NOTE_LENGTH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trim + cap a poll's options, dropping blanks. Returns [] if unusable. */
function sanitizePollOptions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const opts = input
    .filter((o): o is string => typeof o === "string")
    .map((o) => o.trim().slice(0, MAX_POLL_OPTION_LENGTH))
    .filter((o) => !!o)
    .slice(0, MAX_POLL_OPTIONS);
  return opts.length >= MIN_POLL_OPTIONS ? opts : [];
}

/** A valid ISO-8601 instant, or null. Rejects non-parsing / garbage strings
 *  outright rather than silently coercing them (an event with a nonsense
 *  date is worse than one that failed to send). */
function parseIsoInstant(input: unknown): string | null {
  if (typeof input !== "string" || !input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Whitelist incoming attachment fields and cap the count — never trust the client's
// shape verbatim (e.g. a stale `url` must never get persisted into the jsonb column).
function sanitizeAttachments(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a): a is Record<string, unknown> => {
      if (!a || typeof a !== "object") return false;
      const type = (a as Record<string, unknown>).type;
      if (typeof type !== "string") return false;
      if (STORAGE_ATTACHMENT_TYPES.has(type)) {
        const path = (a as Record<string, unknown>).path;
        return typeof path === "string" && !!path;
      }
      if (REFERENCE_ATTACHMENT_TYPES.has(type)) {
        // A contact persists ONLY the id — the display fields are resolved
        // per-request (see hydrateContactAttachments), so anything else the
        // client sends is dropped here rather than frozen into the column.
        const userId = (a as Record<string, unknown>).userId;
        return typeof userId === "string" && UUID_RE.test(userId);
      }
      if (type === "story") {
        // stories.md 4.2/4.4 — a fourth shape: like "contact", the client
        // sends only the id; UNLIKE contact, the server snapshots the
        // display fields ONCE at send time (resolveStoryAttachment, below)
        // rather than re-resolving them live on every read — the whole point
        // being that the message must survive the story's own expiry with
        // its own frozen copy, not a dangling reference to a row whose media
        // has since been stripped.
        const storyId = (a as Record<string, unknown>).storyId;
        return typeof storyId === "string" && UUID_RE.test(storyId);
      }
      if (type === "poll") {
        const q = (a as Record<string, unknown>).question;
        return (
          typeof q === "string" &&
          !!q.trim() &&
          sanitizePollOptions((a as Record<string, unknown>).options).length > 0
        );
      }
      if (type === "event") {
        const rec = a as Record<string, unknown>;
        const title = typeof rec.title === "string" && !!rec.title.trim();
        const startAt = parseIsoInstant(rec.startAt);
        const endAt = rec.endAt == null ? true : !!parseIsoInstant(rec.endAt);
        // endAt, when present, must not precede startAt — a calendar entry
        // that ends before it starts isn't a validation nitpick, it's
        // nonsense the recipient's calendar app would choke on.
        const endNotBeforeStart =
          rec.endAt == null ||
          (startAt &&
            parseIsoInstant(rec.endAt)! >= startAt);
        return title && !!startAt && endAt && !!endNotBeforeStart;
      }
      if (type === "location") {
        const rec = a as Record<string, unknown>;
        const lat = rec.lat;
        const lng = rec.lng;
        return (
          typeof lat === "number" &&
          typeof lng === "number" &&
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        );
      }
      return false;
    })
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .map((a) =>
      a.type === "contact"
        ? { type: a.type, userId: a.userId }
        : a.type === "story"
        ? { type: a.type, storyId: a.storyId }
        : a.type === "poll"
        ? {
            type: a.type,
            question: (a.question as string).trim().slice(0, MAX_POLL_QUESTION_LENGTH),
            options: sanitizePollOptions(a.options),
          }
        : a.type === "event"
        ? {
            type: a.type,
            title: (a.title as string).trim().slice(0, MAX_EVENT_TITLE_LENGTH),
            startAt: parseIsoInstant(a.startAt),
            endAt: a.endAt == null ? undefined : parseIsoInstant(a.endAt),
            location:
              typeof a.location === "string" && a.location.trim()
                ? a.location.trim().slice(0, MAX_EVENT_LOCATION_LENGTH)
                : undefined,
            note:
              typeof a.note === "string" && a.note.trim()
                ? a.note.trim().slice(0, MAX_EVENT_NOTE_LENGTH)
                : undefined,
          }
        : a.type === "location"
        ? { type: a.type, lat: a.lat, lng: a.lng }
        : {
            type: a.type,
            path: a.path,
            size: typeof a.size === "number" ? a.size : undefined,
            duration: typeof a.duration === "number" ? a.duration : undefined,
            // B7 — the "file" type's display name (upload route already
            // sanitizes it; re-cap the length here too since this is the
            // actual trust boundary for what gets persisted).
            name:
              a.type === "file" && typeof a.name === "string" && a.name
                ? a.name.slice(0, MAX_FILE_NAME_LENGTH)
                : undefined,
          }
    );
}

// This route runs as the CALLER (actor client) so Postgres RLS enforces participation
// (messages_select_participant / messages_insert_sender). The isParticipant() check just
// yields a clean 403 instead of an empty/denied result.

type ReactionAgg = { emoji: string; count: number; mine: boolean };
type ReplyPreview = { id: string; senderId: string; content: string | null; deleted: boolean };

function mapMessage(
  m: Record<string, any>,
  reactions: ReactionAgg[] = [],
  reply: ReplyPreview | null = null,
  viewerId?: string
) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.deleted_at ? null : m.content,
    attachments: m.deleted_at ? [] : m.attachments ?? [],
    replyToId: m.reply_to_id ?? null,
    replyTo: reply,
    expiresAt: m.expires_at ?? null,
    // Listen-once (V2, docs/navbar_physics_and_voice_calls.md): the client
    // never gets a playable url from this route for these — see
    // signAttachmentsForMessages. `voicePlayed`/`voicePlayedByMe` tell it
    // whether to render the spent state without waiting on a failed fetch.
    listenOnce: !!m.listen_once,
    voicePlayed: !!m.voice_played_at,
    voicePlayedByMe: !!viewerId && m.voice_played_by === viewerId,
    // V3 — just a marker of how it was sent; the actual ring is a one-shot
    // Realtime broadcast fired below, never persisted state of its own.
    isCall: !!m.is_call,
    reactions,
    deleted: !!m.deleted_at,
    editedAt: m.edited_at,
    createdAt: m.created_at,
    sender: m.sender
      ? {
          id: m.sender.id,
          username: m.sender.username,
          fullName: m.sender.full_name,
          profileImage: m.sender.profile_image,
        }
      : undefined,
  };
}

const SENDER =
  "sender:profiles!messages_sender_id_fkey(id, username, full_name, profile_image)";
const MESSAGE_COLUMNS =
  `id, conversation_id, sender_id, content, attachments, reply_to_id, expires_at, listen_once, voice_played_at, voice_played_by, is_call, edited_at, deleted_at, created_at, ${SENDER}` as const;

// GET /api/chat/conversations/[id]/messages?before=&limit=  -> messages, newest first.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const timer = createStageTimer("messages");
  const me = await getServerUser(request);
  timer.mark("auth");
  if (!me) {
    timer.finish({ result: "401" });
    return fail("Unauthorized", 401);
  }
  const { id } = await params;
  const db = await createActorClient(request);

  const sp = request.nextUrl.searchParams;
  const before = sp.get("before");
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "30", 10)));

  // One query answers BOTH "is the caller a participant" and "what's their
  // cleared_at cursor" — same table, same two filters. These were two serial
  // round trips (isParticipant() then the cleared_at read) for no reason; the
  // row's existence IS the participation check (RLS enforces it regardless, so
  // this only buys a clean 403 instead of an empty result).
  const { data: meRow } = await db
    .from("conversation_participants")
    .select("user_id, cleared_at")
    .eq("conversation_id", id)
    .eq("user_id", me.id)
    .maybeSingle();
  timer.mark("participantRow");
  if (!meRow) {
    timer.finish({ result: "403" });
    return fail("Not a participant of this conversation", 403);
  }
  // "Clear chat": hide everything at/below the caller's cleared_at cursor.
  const clearedAt: string | null = meRow.cleared_at ?? null;

  let q = db
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  if (clearedAt) q = q.gt("created_at", clearedAt);

  const { data, error } = await q;
  timer.mark("messages");
  if (error) {
    timer.finish({ result: "500" });
    return fail(error.message, 500);
  }
  const rows = data ?? [];

  // Lazy TTL purge (the primary mechanism — see the pg_cron migration for the
  // DB-only backstop): strip any voice attachment past its expires_at right
  // here, before mapping, so the caller never sees stale content/attachments.
  // Masking is synchronous because the response depends on it; the storage
  // delete + DB update are bookkeeping and run after the response is sent.
  const purge = maskExpiredVoiceRows(rows);
  if (purge.ids.length) {
    after(() =>
      persistExpiredVoicePurge(createAdminClient(), purge).catch((e) =>
        console.error("[chat] deferred voice purge failed:", e)
      )
    );
  }

  // Enrich with tapback reactions (aggregated) + a quote preview for replies.
  // Both depend on `rows` but not on each other, so they share one round trip
  // instead of stacking two.
  const ids = rows.map((m: any) => m.id);
  const replyIds = [
    ...new Set(rows.map((m: any) => m.reply_to_id).filter(Boolean)),
  ] as string[];

  // Only messages that actually carry a poll need a vote lookup — most pages
  // have none, and an empty `in()` would still cost a round trip.
  const pollIds = rows
    .filter((m: any) =>
      Array.isArray(m.attachments) && m.attachments[0]?.type === "poll" && !m.deleted_at
    )
    .map((m: any) => m.id);

  const [rxRes, repsRes, votesRes] = await Promise.all([
    ids.length
      ? db.from("message_reactions").select("message_id, emoji, user_id").in("message_id", ids)
      : Promise.resolve({ data: [] as any[] }),
    replyIds.length
      ? db.from("messages").select("id, sender_id, content, deleted_at").in("id", replyIds)
      : Promise.resolve({ data: [] as any[] }),
    pollIds.length
      ? db
          .from("message_poll_votes")
          .select("message_id, option_index, user_id")
          .in("message_id", pollIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  timer.mark("enrich");

  const reactionsByMsg = new Map<string, ReactionAgg[]>();
  const bucket = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const r of rxRes.data ?? []) {
    const byEmoji = bucket.get(r.message_id) ?? new Map();
    const cur = byEmoji.get(r.emoji) ?? { count: 0, mine: false };
    cur.count += 1;
    if (r.user_id === me.id) cur.mine = true;
    byEmoji.set(r.emoji, cur);
    bucket.set(r.message_id, byEmoji);
  }
  for (const [mid, byEmoji] of bucket) {
    reactionsByMsg.set(
      mid,
      [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, ...v }))
    );
  }

  // Poll tallies, folded onto the poll attachment itself so the client reads
  // one object instead of correlating a side-channel list. Voter ids only here;
  // they become {id,name,username,image} in the hydrate pass, batched with the
  // contact lookup so both share a single profiles query.
  const votesByMsg = new Map<string, Map<number, { count: number; mine: boolean; voterIds: string[] }>>();
  for (const v of votesRes.data ?? []) {
    const byOpt = votesByMsg.get(v.message_id) ?? new Map();
    const cur = byOpt.get(v.option_index) ?? { count: 0, mine: false, voterIds: [] };
    cur.count += 1;
    cur.voterIds.push(v.user_id);
    if (v.user_id === me.id) cur.mine = true;
    byOpt.set(v.option_index, cur);
    votesByMsg.set(v.message_id, byOpt);
  }
  for (const m of rows as any[]) {
    if (!Array.isArray(m.attachments) || m.attachments[0]?.type !== "poll") continue;
    const byOpt = votesByMsg.get(m.id);
    const optionCount = (m.attachments[0].options as unknown[])?.length ?? 0;
    m.attachments = [
      {
        ...m.attachments[0],
        votes: Array.from({ length: optionCount }, (_, i) =>
          byOpt?.get(i) ?? { count: 0, mine: false, voterIds: [] }
        ),
      },
    ];
  }

  const replyById = new Map<string, ReplyPreview>();
  for (const r of repsRes.data ?? [])
    replyById.set(r.id, {
      id: r.id,
      senderId: r.sender_id,
      content: r.deleted_at ? null : r.content,
      deleted: !!r.deleted_at,
    });

  // Return chronological (oldest -> newest) for easy append rendering.
  const messages = rows
    .map((m: any) =>
      mapMessage(
        m,
        reactionsByMsg.get(m.id) ?? [],
        m.reply_to_id ? replyById.get(m.reply_to_id) ?? null : null,
        me.id
      )
    )
    .reverse();

  // Resolve every attachment's per-request fields: storage paths -> fresh
  // signed URLs, and contact ids -> profile display fields. Requires the admin
  // client for the signing half: chat-attachments' storage RLS is
  // owner-path-scoped, so a caller reading a conversation peer's attachment
  // could never sign it via their own actor client.
  const signed = await resolveAttachmentsForMessages(createAdminClient(), messages);
  timer.mark("signAttachments");
  timer.finish({ count: signed.length });
  return ok(signed, "Messages fetched");
}

// POST /api/chat/conversations/[id]/messages  body { content, attachments? } -> send a message.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  // Anti-spam on messaging: max 30 / 60s per user.
  const limited = await enforceRateLimit("chat-send", me.id, request, 30, 60);
  if (limited) return limited;

  const { id } = await params;
  const db = await createActorClient(request);
  if (!(await isParticipant(db, id, me.id)))
    return fail("Not a participant of this conversation", 403);
  if (await isBlockedInConversation(db, id, me.id))
    return fail("You can't message this conversation", 403);

  const body = await request.json().catch(() => ({}));
  const content: string | undefined =
    typeof body.content === "string" ? body.content.trim() : undefined;
  const attachments = sanitizeAttachments(body.attachments);
  const replyToId: string | null =
    typeof body.replyToId === "string" && body.replyToId ? body.replyToId : null;
  if ((!content || content.length === 0) && attachments.length === 0)
    return fail("Message content or an attachment is required", 400);
  if (content && content.length > 4000)
    return fail("Message is too long (max 4000 chars)", 400);

  // A reply must quote a message from THIS conversation.
  let reply: ReplyPreview | null = null;
  if (replyToId) {
    const { data: quoted } = await db
      .from("messages")
      .select("id, sender_id, content, deleted_at, conversation_id")
      .eq("id", replyToId)
      .maybeSingle();
    if (!quoted || quoted.conversation_id !== id)
      return fail("Reply target not found in this conversation", 400);
    reply = {
      id: quoted.id,
      senderId: quoted.sender_id,
      content: quoted.deleted_at ? null : quoted.content,
      deleted: !!quoted.deleted_at,
    };
  }

  // Story quotes (stories.md 4.2/4.4): resolve + snapshot server-side, ONCE,
  // right now — never trust a client-supplied mediaUrl/authorName the way a
  // forged card could smuggle in. RLS (stories_select_visible) IS the entire
  // visibility check here: a story the sender can't currently see (wrong
  // audience, expired, deleted) resolves to no row and the send is rejected
  // — the exact same shape as a reply target that isn't in this conversation.
  let storyExpiresAt: string | null = null;
  if (attachments[0]?.type === "story") {
    const storyId = attachments[0].storyId as string;
    // A template literal (not string concatenation) so postgrest-js's
    // generic select-string parser can statically resolve the embed shape
    // instead of falling back to GenericStringError — same reason
    // MESSAGE_COLUMNS above is built with `as const`.
    const { data: story, error: storyErr } = await db
      .from("stories")
      .select(
        `id, author_profile_id, media_url, alt_text, expires_at, highlighted_at, author:profiles!stories_author_profile_id_fkey(username, full_name, profile_image), place:radar_places!stories_place_id_fkey(title), tribe:tribes!stories_tribe_id_fkey(name)` as const
      )
      .eq("id", storyId)
      .maybeSingle();
    if (storyErr) console.error("[chat] story resolve error:", storyErr.message);
    if (!story) return fail("That story is no longer available", 400);
    const author = (Array.isArray(story.author) ? story.author[0] : story.author) as
      | { username?: string; full_name?: string; profile_image?: string }
      | null;
    const place = (Array.isArray(story.place) ? story.place[0] : story.place) as
      | { title?: string }
      | null;
    const tribe = (Array.isArray(story.tribe) ? story.tribe[0] : story.tribe) as
      | { name?: string }
      | null;
    attachments[0] = {
      type: "story",
      storyId: story.id,
      mediaUrl: story.media_url,
      altText: story.alt_text ?? undefined,
      authorId: story.author_profile_id,
      authorName: author?.full_name || author?.username || undefined,
      authorImage: author?.profile_image ?? undefined,
      placeTitle: place?.title ?? undefined,
      tribeName: tribe?.name ?? undefined,
    };
    // A highlight (Phase 5, not shipped yet) never expires, so the quote
    // shouldn't either — every LIVE story today always has a real
    // expires_at, so this branch is dead code until Phase 5 ships, kept
    // here rather than left as a gap that would silently mis-expire a kept
    // story's quote later.
    storyExpiresAt = story.highlighted_at ? null : story.expires_at;
  }

  // Voice notes are ephemeral: 24h from send, enforced both by the lazy
  // purge-on-read above and the pg_cron backstop.
  const hasVoice = attachments.some((a) => a.type === "voice");
  const expiresAt = hasVoice
    ? new Date(Date.now() + VOICE_TTL_MS).toISOString()
    : storyExpiresAt;
  // Listen-once (V2): sender opts in per message, at send time. Meaningless
  // without a voice attachment, so silently ignored on a text-only send
  // rather than erroring over a client bug that can't affect anything.
  const listenOnce = hasVoice && body.listenOnce === true;
  // "Send as a call" (V3): same opt-in-per-message shape as listenOnce, and
  // independently toggleable (a call can also be listen-once).
  const isCall = hasVoice && body.isCall === true;

  const { data: inserted, error } = await db
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: me.id,
      content: content ?? null,
      attachments,
      reply_to_id: replyToId,
      expires_at: expiresAt,
      listen_once: listenOnce,
      is_call: isCall,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !inserted) return fail(error?.message || "Failed to send", 500);

  // Bump the conversation's last-message pointer for ordering + previews.
  await db
    .from("conversations")
    .update({ last_message_id: inserted.id, last_message_at: inserted.created_at })
    .eq("id", id);

  const admin = createAdminClient();
  const mapped = mapMessage(inserted, [], reply, me.id);

  // V3 — the ring itself is a one-shot Realtime Broadcast to the recipient's
  // personal channel, never persisted: whichever of their devices happen to
  // have the app open right now (see otter_flutter's global `calls:{uid}`
  // listener) shows the incoming-call UI; if nobody's listening, this is a
  // no-op and the message just sits there as a normal voice note — that IS
  // the fallback, there's no separate state to time out or clean up.
  // DIRECT only (group "calls" are out of scope for v1); best-effort, must
  // never fail the send itself.
  if (isCall) {
    try {
      const peerId = await getDirectPeerId(db, id, me.id);
      if (peerId) {
        const { data: peerRow } = await admin
          .from("conversation_participants")
          .select("muted")
          .eq("conversation_id", id)
          .eq("user_id", peerId)
          .maybeSingle();
        if (!peerRow?.muted) {
          await admin.channel(`calls:${peerId}`).httpSend("incoming_call", {
            conversationId: id,
            messageId: inserted.id,
            callerId: me.id,
            callerName: mapped.sender?.fullName ?? mapped.sender?.username ?? "Someone",
            callerImage: mapped.sender?.profileImage ?? null,
            durationSeconds: attachments[0]?.duration ?? null,
          });
        }
      }
    } catch (e) {
      captureRouteError(e instanceof Error ? e.message : "call broadcast failed", {
        conversationId: id,
      });
    }
  }

  // Same two-part resolve as the GET path, for the just-sent message's own
  // echo — so a contact bubble renders immediately instead of waiting for the
  // sender's next fetch to fill its name/avatar in.
  const signedAttachments = await signAttachments(admin, mapped.attachments, mapped.listenOnce);
  const [resolved] = await hydrateContactAttachments(admin, [
    { ...mapped, attachments: signedAttachments },
  ]);
  return ok(resolved, "Message sent");
}
