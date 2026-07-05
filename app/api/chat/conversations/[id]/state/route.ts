import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/chat/conversations/[id]/state
//   body { archived?, accept?, muted?, pinned? }
//   accept:true          -> accept a message request (accept_conversation_request)
//   archived:true|false  -> archive / unarchive (set_conversation_archived)
//   muted:true|false     -> mute / unmute (chat_set_muted)
//   pinned:true|false    -> pin / unpin (chat_set_pinned)
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

  if (typeof body.muted === "boolean") {
    const { data, error } = await db.rpc("chat_set_muted", {
      p_conversation: id,
      p_muted: body.muted,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : 500;
      return fail(error.message, status);
    }
    return ok(data, body.muted ? "Conversation muted" : "Conversation unmuted");
  }

  if (typeof body.pinned === "boolean") {
    const { data, error } = await db.rpc("chat_set_pinned", {
      p_conversation: id,
      p_pinned: body.pinned,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : 500;
      return fail(error.message, status);
    }
    return ok(data, body.pinned ? "Conversation pinned" : "Conversation unpinned");
  }

  return fail("Nothing to update", 400);
}
