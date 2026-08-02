import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { isParticipant } from "@/lib/api/chat-guards";
import { CHAT_ATTACHMENTS_BUCKET, type ChatAttachment } from "@/lib/api/chat-attachments";

// A signed URL minted here only needs to live long enough for the client to
// start streaming — unlike the eager list-time signing (1h TTL), this one is
// requested right at tap-to-play, so it can stay short.
const VOICE_URL_TTL_SECONDS = 120;

/**
 * POST /api/chat/conversations/[id]/messages/[messageId]/voice-url
 *
 * The ONLY way to get a playable URL for a listen-once voice message (see V2,
 * docs/navbar_physics_and_voice_calls.md) — the messages GET route
 * deliberately withholds `url` for these (signAttachmentsForMessages). The
 * sender can always re-fetch (they already know what they said); the first
 * non-sender participant to call this consumes the single play, atomically —
 * a second caller (or a retry after the fact) gets 410, never a fresh URL.
 * The consumed row isn't scrubbed here: that's the existing lazy
 * purge-on-read path (purgeExpiredVoiceRows), reused rather than duplicated,
 * on the next messages GET.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const limited = await enforceRateLimit("chat-voice-url", me.id, request, 30, 60);
  if (limited) return limited;

  const { id, messageId } = await params;
  const db = await createActorClient(request);
  if (!(await isParticipant(db, id, me.id)))
    return fail("Not a participant of this conversation", 403);

  const { data: msg } = await db
    .from("messages")
    .select(
      "id, conversation_id, sender_id, attachments, listen_once, voice_played_at, deleted_at"
    )
    .eq("id", messageId)
    .maybeSingle();
  if (!msg || msg.conversation_id !== id) return fail("Message not found", 404);
  if (msg.deleted_at) return fail("Message not found", 404);
  if (!msg.listen_once) return fail("This message isn't a listen-once voice note", 400);

  const attachment = ((msg.attachments ?? []) as ChatAttachment[]).find(
    (a) => a?.type === "voice" && a?.path
  );
  if (!attachment?.path)
    return fail("This voice message is no longer available", 410);

  const admin = createAdminClient();
  const isSender = msg.sender_id === me.id;

  if (!isSender) {
    if (msg.voice_played_at) {
      return fail("This voice message has already been played", 410);
    }
    // Atomic consume: only succeeds if still unplayed at the moment of the
    // update, so two concurrent requests (retry, double-tap) can't both win.
    const { data: consumed, error: consumeError } = await admin
      .from("messages")
      .update({ voice_played_at: new Date().toISOString(), voice_played_by: me.id })
      .eq("id", messageId)
      .is("voice_played_at", null)
      .select("id")
      .maybeSingle();
    if (consumeError) return fail(consumeError.message, 500);
    if (!consumed) return fail("This voice message has already been played", 410);
  }

  const { data: signed, error: signError } = await admin.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.path, VOICE_URL_TTL_SECONDS);
  if (signError || !signed?.signedUrl)
    return fail(signError?.message || "Could not sign playback URL", 500);

  return ok({ url: signed.signedUrl }, "Voice URL issued");
}
