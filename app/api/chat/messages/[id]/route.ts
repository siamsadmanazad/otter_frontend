import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// Actor client: RLS messages_update_sender ensures only the sender can edit/delete.
// Edit/delete windows (decisions locked): ~15 min edit, ~1 h delete-for-everyone.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

const SELECT =
  "id, conversation_id, sender_id, content, attachments, reply_to_id, expires_at, edited_at, deleted_at, created_at";

function mapMessage(m: Record<string, any>) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.deleted_at ? null : m.content,
    attachments: m.deleted_at ? [] : m.attachments ?? [],
    replyToId: m.reply_to_id ?? null,
    expiresAt: m.expires_at ?? null,
    deleted: !!m.deleted_at,
    editedAt: m.edited_at,
    createdAt: m.created_at,
  };
}

// PATCH /api/chat/messages/[id]  body { content } -> edit the caller's own message
// within the edit window. Sets edited_at so clients can show an "Edited" hint.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const content =
    typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return fail("Content is required", 400);
  if (content.length > 4000)
    return fail("Message is too long (max 4000 chars)", 400);

  const db = await createActorClient(request);
  const { data: existing } = await db
    .from("messages")
    .select("id, sender_id, created_at, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.sender_id !== me.id)
    return fail("Message not found or not yours", 404);
  if (existing.deleted_at) return fail("Cannot edit a deleted message", 400);
  if (Date.now() - new Date(existing.created_at).getTime() > EDIT_WINDOW_MS)
    return fail("Edit window has passed", 400);

  const { data, error } = await db
    .from("messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", me.id)
    .select(SELECT)
    .single();
  if (error || !data) return fail(error?.message || "Failed to edit", 500);
  return ok(mapMessage(data), "Message edited");
}

// DELETE /api/chat/messages/[id] -> soft-delete the caller's own message for
// everyone (leaves a tombstone), within the delete window.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = await createActorClient(request);

  const { data: existing } = await db
    .from("messages")
    .select("id, sender_id, created_at, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.sender_id !== me.id)
    return fail("Message not found or not yours", 404);
  if (existing.deleted_at) return ok({ id }, "Already deleted");
  if (Date.now() - new Date(existing.created_at).getTime() > DELETE_WINDOW_MS)
    return fail("Delete window has passed", 400);

  const { data, error } = await db
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", me.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("Message not found or not yours", 404);
  return ok({ id }, "Message deleted");
}
