import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/chat/conversations/[id]/state  body { archived?: boolean, accept?: true }
//   accept:true        -> accept a message request (accept_conversation_request)
//   archived:true|false -> archive / unarchive (set_conversation_archived)
// Actor client so the RPCs resolve auth.uid() to the caller's participant row.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const db = await createActorClient(request);

  if (body.accept === true) {
    const { data, error } = await db.rpc("accept_conversation_request", {
      p_conversation: id,
    });
    if (error) return fail(error.message, 500);
    return ok(data, "Request accepted");
  }

  if (typeof body.archived === "boolean") {
    const { data, error } = await db.rpc("set_conversation_archived", {
      p_conversation: id,
      p_archived: body.archived,
    });
    if (error) return fail(error.message, 500);
    return ok(data, body.archived ? "Conversation archived" : "Conversation unarchived");
  }

  return fail("Nothing to update", 400);
}
