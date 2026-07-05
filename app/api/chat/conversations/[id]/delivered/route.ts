import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/chat/conversations/[id]/delivered -> advance the caller's delivered
// cursor (last_delivered_at) to now(). Powers the sender's Delivered receipt.
// Writes through the SECURITY DEFINER RPC (conversation_participants has no direct
// UPDATE policy — see chat_mark_delivered in 20260706120000_chat_cursors.sql).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = await createActorClient(request);

  const { data, error } = await db.rpc("chat_mark_delivered", {
    p_conversation: id,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return fail(error.message, status);
  }
  return ok(data, "Delivered cursor advanced");
}
