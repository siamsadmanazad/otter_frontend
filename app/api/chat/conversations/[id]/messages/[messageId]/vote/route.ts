import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { isParticipant } from "@/lib/api/chat-guards";
import { captureRouteError } from "@/lib/observability";

// POST /api/chat/conversations/[id]/messages/[messageId]/vote
// Body: { optionIndex: number | null }  — null clears the caller's vote.
//
// v1 is SINGLE-CHOICE and changeable (dm_redesign.md Step B7, OStad
// 2026-08-19): every write clears the caller's existing rows for this poll
// first, so re-voting moves the vote rather than stacking. The table's PK is
// (message_id, user_id, option_index) so allowing multi-select later is a
// change here, not a migration.
//
// Runs as the CALLER (actor client) so RLS is the real enforcement:
// message_poll_votes_insert_self already requires user_id = auth.uid() AND
// conversation participation. isParticipant() just turns a denied write into a
// clean 403 instead of an opaque empty result.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id, messageId } = await params;
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const limited = await enforceRateLimit("chat-poll-vote", me.id, request, 60, 60);
  if (limited) return limited;

  let optionIndex: number | null;
  try {
    const body = await request.json();
    optionIndex = body?.optionIndex ?? null;
  } catch {
    return fail("Invalid body", 400);
  }
  if (
    optionIndex !== null &&
    (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= 10)
  ) {
    return fail("Invalid option", 400);
  }

  try {
    const db = await createActorClient(request);
    if (!(await isParticipant(db, id, me.profileId)))
      return fail("Not a participant", 403);

    // Confirm the target really is a poll in THIS conversation before writing —
    // otherwise a valid participant could vote against an arbitrary message id.
    const { data: msg } = await db
      .from("messages")
      .select("id, attachments, deleted_at")
      .eq("id", messageId)
      .eq("conversation_id", id)
      .maybeSingle();
    if (!msg || msg.deleted_at) return fail("Poll not found", 404);

    const poll = Array.isArray(msg.attachments) ? (msg.attachments[0] as any) : null;
    if (poll?.type !== "poll") return fail("Not a poll", 400);
    if (optionIndex !== null && optionIndex >= (poll.options?.length ?? 0))
      return fail("Invalid option", 400);

    // Clear then (maybe) set — this is what makes a vote changeable.
    await db
      .from("message_poll_votes")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", me.profileId);

    if (optionIndex !== null) {
      const { error } = await db
        .from("message_poll_votes")
        .insert({ message_id: messageId, user_id: me.profileId, option_index: optionIndex });
      if (error) return fail(error.message, 500);
    }

    return ok({ optionIndex }, "Vote recorded");
  } catch (error) {
    captureRouteError("chat poll vote failed", { error: String(error) });
    return fail("Failed to record vote", 500);
  }
}
