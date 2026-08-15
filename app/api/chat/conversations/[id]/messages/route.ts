import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import {
  signAttachments,
  signAttachmentsForMessages,
  purgeExpiredVoiceRows,
} from "@/lib/api/chat-attachments";
import {
  isBlockedInConversation,
  isParticipant,
  getDirectPeerId,
} from "@/lib/api/chat-guards";
import { captureRouteError } from "@/lib/observability";
import { createStageTimer } from "@/lib/api/timing";

const VOICE_TTL_MS = 24 * 60 * 60 * 1000;

const ATTACHMENT_TYPES = new Set(["image", "video", "voice"]);
const MAX_ATTACHMENTS_PER_MESSAGE = 1;

// Whitelist incoming attachment fields and cap the count — never trust the client's
// shape verbatim (e.g. a stale `url` must never get persisted into the jsonb column).
function sanitizeAttachments(input: unknown): Record<string, unknown>[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (a): a is Record<string, unknown> =>
        !!a &&
        typeof a === "object" &&
        typeof (a as Record<string, unknown>).type === "string" &&
        ATTACHMENT_TYPES.has((a as Record<string, unknown>).type as string) &&
        typeof (a as Record<string, unknown>).path === "string" &&
        !!(a as Record<string, unknown>).path
    )
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .map((a) => ({
      type: a.type,
      path: a.path,
      size: typeof a.size === "number" ? a.size : undefined,
      duration: typeof a.duration === "number" ? a.duration : undefined,
    }));
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
  if (!(await isParticipant(db, id, me.id))) {
    timer.mark("isParticipant");
    timer.finish({ result: "403" });
    return fail("Not a participant of this conversation", 403);
  }
  timer.mark("isParticipant");

  const sp = request.nextUrl.searchParams;
  const before = sp.get("before");
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "30", 10)));

  // "Clear chat": hide everything at/below the caller's cleared_at cursor.
  const { data: meRow } = await db
    .from("conversation_participants")
    .select("cleared_at")
    .eq("conversation_id", id)
    .eq("user_id", me.id)
    .maybeSingle();
  const clearedAt: string | null = meRow?.cleared_at ?? null;
  timer.mark("clearedAt");

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
  await purgeExpiredVoiceRows(createAdminClient(), rows);
  timer.mark("purgeExpiredVoice");

  // Enrich with tapback reactions (aggregated) + a quote preview for replies.
  const ids = rows.map((m: any) => m.id);
  const reactionsByMsg = new Map<string, ReactionAgg[]>();
  if (ids.length) {
    const { data: rx } = await db
      .from("message_reactions")
      .select("message_id, emoji, user_id")
      .in("message_id", ids);
    timer.mark("reactions");
    const bucket = new Map<string, Map<string, { count: number; mine: boolean }>>();
    for (const r of rx ?? []) {
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
  }

  const replyIds = [
    ...new Set(rows.map((m: any) => m.reply_to_id).filter(Boolean)),
  ] as string[];
  const replyById = new Map<string, ReplyPreview>();
  if (replyIds.length) {
    const { data: reps } = await db
      .from("messages")
      .select("id, sender_id, content, deleted_at")
      .in("id", replyIds);
    timer.mark("replyPreviews");
    for (const r of reps ?? [])
      replyById.set(r.id, {
        id: r.id,
        senderId: r.sender_id,
        content: r.deleted_at ? null : r.content,
        deleted: !!r.deleted_at,
      });
  }

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

  // Resolve attachment paths to fresh signed URLs. Requires the admin client:
  // chat-attachments' storage RLS is owner-path-scoped, so a caller reading a
  // conversation peer's attachment could never sign it via their own actor client.
  const signed = await signAttachmentsForMessages(createAdminClient(), messages);
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

  // Voice notes are ephemeral: 24h from send, enforced both by the lazy
  // purge-on-read above and the pg_cron backstop.
  const hasVoice = attachments.some((a) => a.type === "voice");
  const expiresAt = hasVoice ? new Date(Date.now() + VOICE_TTL_MS).toISOString() : null;
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

  const signedAttachments = await signAttachments(admin, mapped.attachments, mapped.listenOnce);
  return ok({ ...mapped, attachments: signedAttachments }, "Message sent");
}
