import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

function mapMessage(m: Record<string, any>) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.deleted_at ? null : m.content,
    attachments: m.deleted_at ? [] : m.attachments ?? [],
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
  const db = createAdminClient();
  if (!(await isParticipant(db, id, me.id)))
    return fail("Not a participant of this conversation", 403);

  const sp = request.nextUrl.searchParams;
  const before = sp.get("before");
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "30", 10)));

  let q = db
    .from("messages")
    .select(`id, conversation_id, sender_id, content, attachments, edited_at, deleted_at, created_at, ${SENDER}`)
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  // Return chronological (oldest -> newest) for easy append rendering.
  const messages = (data ?? []).map(mapMessage).reverse();
  return ok(messages, "Messages fetched");
}

// POST /api/chat/conversations/[id]/messages  body { content, attachments? } -> send a message.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = createAdminClient();
  if (!(await isParticipant(db, id, me.id)))
    return fail("Not a participant of this conversation", 403);

  const body = await request.json().catch(() => ({}));
  const content: string | undefined =
    typeof body.content === "string" ? body.content.trim() : undefined;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if ((!content || content.length === 0) && attachments.length === 0)
    return fail("Message content or an attachment is required", 400);
  if (content && content.length > 4000)
    return fail("Message is too long (max 4000 chars)", 400);

  const { data: inserted, error } = await db
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: me.id,
      content: content ?? null,
      attachments,
    })
    .select(`id, conversation_id, sender_id, content, attachments, edited_at, deleted_at, created_at, ${SENDER}`)
    .single();
  if (error || !inserted) return fail(error?.message || "Failed to send", 500);

  // Bump the conversation's last-message pointer for ordering + previews.
  await db
    .from("conversations")
    .update({ last_message_id: inserted.id, last_message_at: inserted.created_at })
    .eq("id", id);

  return ok(mapMessage(inserted), "Message sent");
}
