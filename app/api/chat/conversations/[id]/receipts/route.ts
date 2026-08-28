import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { createStageTimer } from "@/lib/api/timing";

// GET /api/chat/conversations/[id]/receipts
//   -> { peerId, peerDeliveredAt, peerReadAt }
// Powers the sender's status line (Delivered / Seen). "Seen" is derived from
// message_reads (the newest of MY messages the peer has read); "Delivered" from
// the peer's last_delivered_at cursor. Actor client → RLS scopes everything to
// conversations the caller participates in.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const timer = createStageTimer("receipts");
  const me = await getServerUser(request);
  timer.mark("auth");
  if (!me) {
    timer.finish({ result: "401" });
    return fail("Unauthorized", 401);
  }
  const { id } = await params;
  const db = await createActorClient(request);

  // The participants (for the peer + their delivered cursor) and my own recent
  // messages (for the read cursor) depend only on the conversation id, not on
  // each other — one round trip instead of two. RLS scopes both to
  // conversations the caller participates in, so fetching my messages
  // concurrently with the membership check leaks nothing on the 403 path.
  const [partsRes, mineRes] = await Promise.all([
    db
      .from("conversation_participants")
      .select("user_id, last_delivered_at")
      .eq("conversation_id", id),
    db
      .from("messages")
      .select("id, created_at")
      .eq("conversation_id", id)
      .eq("sender_id", me.profileId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  timer.mark("participants+myMessages");
  const { data: parts, error: pErr } = partsRes;
  if (pErr) {
    timer.finish({ result: "500" });
    return fail(pErr.message, 500);
  }
  if (!(parts ?? []).some((p: any) => p.user_id === me.profileId)) {
    timer.finish({ result: "403" });
    return fail("Not a participant of this conversation", 403);
  }
  const peer = (parts ?? []).find((p: any) => p.user_id !== me.profileId);
  if (!peer) {
    timer.finish({ result: "no-peer" });
    return ok({ peerId: null, peerDeliveredAt: null, peerReadAt: null }, "No peer");
  }

  // Newest of my messages that the peer has read → peerReadAt.
  const mine = mineRes.data;
  const mineIds = (mine ?? []).map((m: any) => m.id);
  let peerReadAt: string | null = null;
  if (mineIds.length) {
    const { data: reads } = await db
      .from("message_reads")
      .select("message_id")
      .eq("user_id", peer.user_id)
      .in("message_id", mineIds);
    timer.mark("reads");
    const readSet = new Set((reads ?? []).map((r: any) => r.message_id));
    for (const m of mine ?? []) {
      if (readSet.has(m.id)) {
        peerReadAt = m.created_at; // list is newest-first → first hit is newest
        break;
      }
    }
  }

  timer.finish();
  return ok(
    {
      peerId: peer.user_id,
      peerDeliveredAt: peer.last_delivered_at ?? null,
      peerReadAt,
    },
    "Receipts fetched"
  );
}
