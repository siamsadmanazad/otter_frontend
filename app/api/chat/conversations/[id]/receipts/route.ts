import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

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
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = await createActorClient(request);

  // The other participant (1:1) + their delivered cursor.
  const { data: parts, error: pErr } = await db
    .from("conversation_participants")
    .select("user_id, last_delivered_at")
    .eq("conversation_id", id);
  if (pErr) return fail(pErr.message, 500);
  if (!(parts ?? []).some((p: any) => p.user_id === me.id))
    return fail("Not a participant of this conversation", 403);
  const peer = (parts ?? []).find((p: any) => p.user_id !== me.id);
  if (!peer) return ok({ peerId: null, peerDeliveredAt: null, peerReadAt: null }, "No peer");

  // Newest of my messages that the peer has read → peerReadAt.
  const { data: mine } = await db
    .from("messages")
    .select("id, created_at")
    .eq("conversation_id", id)
    .eq("sender_id", me.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const mineIds = (mine ?? []).map((m: any) => m.id);
  let peerReadAt: string | null = null;
  if (mineIds.length) {
    const { data: reads } = await db
      .from("message_reads")
      .select("message_id")
      .eq("user_id", peer.user_id)
      .in("message_id", mineIds);
    const readSet = new Set((reads ?? []).map((r: any) => r.message_id));
    for (const m of mine ?? []) {
      if (readSet.has(m.id)) {
        peerReadAt = m.created_at; // list is newest-first → first hit is newest
        break;
      }
    }
  }

  return ok(
    {
      peerId: peer.user_id,
      peerDeliveredAt: peer.last_delivered_at ?? null,
      peerReadAt,
    },
    "Receipts fetched"
  );
}
