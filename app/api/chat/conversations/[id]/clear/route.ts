import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/chat/conversations/[id]/clear -> "clear chat" for the caller only:
// sets cleared_at = now() so the messages GET hides everything at/below it. The
// other participant is unaffected. Writes through the SECURITY DEFINER RPC
// (see chat_clear in 20260706120000_chat_cursors.sql).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = await createActorClient(request);

  const { data, error } = await db.rpc("chat_clear", { p_conversation: id });
  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return fail(error.message, status);
  }
  return ok(data, "Conversation cleared");
}
