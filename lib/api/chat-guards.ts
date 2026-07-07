import type { SupabaseClient } from "@supabase/supabase-js";
import { isBlockedPair } from "@/lib/api/blocks";

/** For a DIRECT conversation, the other participant's id (null for GROUP or if not found). */
export async function getDirectPeerId(
  db: SupabaseClient,
  conversationId: string,
  meId: string
): Promise<string | null> {
  const { data: convo } = await db
    .from("conversations")
    .select("type")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo || convo.type !== "DIRECT") return null;
  const { data: rows } = await db
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .neq("user_id", meId)
    .limit(1);
  return rows?.[0]?.user_id ?? null;
}

/**
 * True if the caller is blocked (either direction) by the other participant of
 * a DIRECT conversation. Always false for GROUP conversations — block
 * semantics are pairwise-only for v1, consistent with wallet_transfer's
 * block check. RLS only enforces participation, not blocks, so chat's
 * send/react paths call this explicitly (the confirmed real gap).
 */
export async function isBlockedInConversation(
  db: SupabaseClient,
  conversationId: string,
  meId: string
): Promise<boolean> {
  const peerId = await getDirectPeerId(db, conversationId, meId);
  if (!peerId) return false;
  return isBlockedPair(db, meId, peerId);
}
