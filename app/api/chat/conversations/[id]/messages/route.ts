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
  reply: ReplyPreview | null = null
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

async function isParticipant(db: any, conversationId: string, userId: string) {
  const { data } = await db
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

const SENDER =
  "sender:profiles!messages_sender_id_fkey(id, username, full_name, profile_image)";

// GET /api/chat/conversations/[id]/messages?before=&limit=  -> messages, newest first.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = await createActorClient(request);
  if (!(await isParticipant(db, id, me.id)))
    return fail("Not a participant of this conversation", 403);

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

  let q = db
    .from("messages")
    .select(
      `id, conversation_id, sender_id, content, attachments, reply_to_id, expires_at, edited_at, deleted_at, created_at, ${SENDER}`
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  if (clearedAt) q = q.gt("created_at", clearedAt);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  const rows = data ?? [];

  // Lazy TTL purge (the primary mechanism — see the pg_cron migration for the
  // DB-only backstop): strip any voice attachment past its expires_at right
  // here, before mapping, so the caller never sees stale content/attachments.
  await purgeExpiredVoiceRows(createAdminClient(), rows);

  // Enrich with tapback reactions (aggregated) + a quote preview for replies.
  const ids = rows.map((m: any) => m.id);
  const reactionsByMsg = new Map<string, ReactionAgg[]>();
  if (ids.length) {
    const { data: rx } = await db
      .from("message_reactions")
      .select("message_id, emoji, user_id")
      .in("message_id", ids);
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
        m.reply_to_id ? replyById.get(m.reply_to_id) ?? null : null
      )
    )
    .reverse();

  // Resolve attachment paths to fresh signed URLs. Requires the admin client:
  // chat-attachments' storage RLS is owner-path-scoped, so a caller reading a
  // conversation peer's attachment could never sign it via their own actor client.
  const signed = await signAttachmentsForMessages(createAdminClient(), messages);
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

  const { data: inserted, error } = await db
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: me.id,
      content: content ?? null,
      attachments,
      reply_to_id: replyToId,
      expires_at: expiresAt,
    })
    .select(
      `id, conversation_id, sender_id, content, attachments, reply_to_id, expires_at, edited_at, deleted_at, created_at, ${SENDER}`
    )
    .single();
  if (error || !inserted) return fail(error?.message || "Failed to send", 500);

  // Bump the conversation's last-message pointer for ordering + previews.
  await db
    .from("conversations")
    .update({ last_message_id: inserted.id, last_message_at: inserted.created_at })
    .eq("id", id);

  const mapped = mapMessage(inserted, [], reply);
  const signedAttachments = await signAttachments(createAdminClient(), mapped.attachments);
  return ok({ ...mapped, attachments: signedAttachments }, "Message sent");
}
