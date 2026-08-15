import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { createStageTimer } from "@/lib/api/timing";

// Actor client: RLS (message_reads_insert_self + messages_select_participant) enforces
// that the caller can only mark their own reads on conversations they belong to.

// POST /api/chat/conversations/[id]/read -> mark the other party's messages in this
// conversation as read by the caller (powers unread badges + "seen" receipts).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const timer = createStageTimer("read");
  const me = await getServerUser(request);
  timer.mark("auth");
  if (!me) {
    timer.finish({ result: "401" });
    return fail("Unauthorized", 401);
  }
  const { id } = await params;
  const db = await createActorClient(request);

  // Membership check and the inbound-message scan depend only on the
  // conversation id, not on each other — one round trip instead of two. RLS
  // (messages_select_participant) scopes the message read independently, so
  // running it before the membership branch resolves cannot leak anything.
  const [memberRes, inboundRes] = await Promise.all([
    db
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", id)
      .eq("user_id", me.id)
      .maybeSingle(),
    // Most recent inbound messages (bounded) that the caller hasn't read yet.
    db
      .from("messages")
      .select("id")
      .eq("conversation_id", id)
      .neq("sender_id", me.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  timer.mark("member+inbound");
  if (!memberRes.data) {
    timer.finish({ result: "403" });
    return fail("Not a participant of this conversation", 403);
  }
  const inboundIds = (inboundRes.data ?? []).map((m: any) => m.id);
  if (inboundIds.length === 0) {
    timer.finish({ marked: 0 });
    return ok({ marked: 0 }, "Nothing to mark");
  }

  const { data: already } = await db
    .from("message_reads")
    .select("message_id")
    .eq("user_id", me.id)
    .in("message_id", inboundIds);
  timer.mark("already");
  const readSet = new Set((already ?? []).map((r: any) => r.message_id));
  const toInsert = inboundIds
    .filter((mid: string) => !readSet.has(mid))
    .map((mid: string) => ({ message_id: mid, user_id: me.id }));

  if (toInsert.length === 0) {
    timer.finish({ marked: 0 });
    return ok({ marked: 0 }, "Already read");
  }
  const { error } = await db.from("message_reads").insert(toInsert);
  timer.mark("insert");
  if (error) {
    timer.finish({ result: "500" });
    return fail(error.message, 500);
  }
  timer.finish({ marked: toInsert.length });
  return ok({ marked: toInsert.length }, "Marked read");
}
