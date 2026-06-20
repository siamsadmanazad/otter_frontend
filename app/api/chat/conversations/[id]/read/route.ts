import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/chat/conversations/[id]/read -> mark the other party's messages in this
// conversation as read by the caller (powers unread badges + "seen" receipts).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = createAdminClient();

  const { data: member } = await db
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!member) return fail("Not a participant of this conversation", 403);

  // Most recent inbound messages (bounded) that the caller hasn't read yet.
  const { data: inbound } = await db
    .from("messages")
    .select("id")
    .eq("conversation_id", id)
    .neq("sender_id", me.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const inboundIds = (inbound ?? []).map((m: any) => m.id);
  if (inboundIds.length === 0) return ok({ marked: 0 }, "Nothing to mark");

  const { data: already } = await db
    .from("message_reads")
    .select("message_id")
    .eq("user_id", me.id)
    .in("message_id", inboundIds);
  const readSet = new Set((already ?? []).map((r: any) => r.message_id));
  const toInsert = inboundIds
    .filter((mid: string) => !readSet.has(mid))
    .map((mid: string) => ({ message_id: mid, user_id: me.id }));

  if (toInsert.length === 0) return ok({ marked: 0 }, "Already read");
  const { error } = await db.from("message_reads").insert(toInsert);
  if (error) return fail(error.message, 500);
  return ok({ marked: toInsert.length }, "Marked read");
}
