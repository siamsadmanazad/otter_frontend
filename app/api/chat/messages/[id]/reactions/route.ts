import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { isBlockedInConversation } from "@/lib/api/chat-guards";

// Tapback set (iMessage-style). Kept small + validated so the reactions column
// stays a closed vocabulary.
const ALLOWED = new Set(["❤️", "👍", "👎", "😂", "‼️", "❓"]);

// Actor client: RLS (message_reactions_insert_self / _delete_self, both gated on
// conversation participation) enforces that you only manage your own tapbacks on
// messages in conversations you belong to.

// POST /api/chat/messages/[id]/reactions  body { emoji } -> add the caller's tapback.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!ALLOWED.has(emoji)) return fail("Unsupported reaction", 400);

  const db = await createActorClient(request);
  const { data: msg } = await db
    .from("messages")
    .select("conversation_id")
    .eq("id", id)
    .maybeSingle();
  if (msg && (await isBlockedInConversation(db, msg.conversation_id, me.id)))
    return fail("You can't react in this conversation", 403);

  const { error } = await db
    .from("message_reactions")
    .upsert(
      { message_id: id, user_id: me.id, emoji },
      { onConflict: "message_id,user_id,emoji" }
    );
  if (error) return fail(error.message, 500);
  return ok({ messageId: id, emoji }, "Reaction added");
}

// DELETE /api/chat/messages/[id]/reactions?emoji= -> remove the caller's tapback.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const emoji = request.nextUrl.searchParams.get("emoji") || "";
  if (!emoji) return fail("emoji is required", 400);

  const db = await createActorClient(request);
  const { error } = await db
    .from("message_reactions")
    .delete()
    .eq("message_id", id)
    .eq("user_id", me.id)
    .eq("emoji", emoji);
  if (error) return fail(error.message, 500);
  return ok({ messageId: id, emoji }, "Reaction removed");
}
