import sharp from "sharp";
import { Buffer } from "buffer";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { enforceRateLimit } from "@/lib/ratelimit";
import { moderateImage } from "@/lib/moderation";
import { ok, fail } from "@/lib/api/http";
import { captureRouteError } from "@/lib/observability";
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/api/chat-attachments";

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_VOICE_MB = 5;
const MAX_VOICE_SECONDS = 130; // client caps recording at 120s; small buffer
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif", "image/heic"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/mpeg", "video/quicktime", "video/x-msvideo"];
const VOICE_TYPES = ["audio/m4a", "audio/x-m4a", "audio/mp4", "audio/aac", "audio/mpeg", "audio/wav"];
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// POST /api/chat/attachments (FormData { file, duration? }) -> upload a photo,
// video, or voice note for a chat message. Mirrors app/api/media/route.ts's
// validation/upload pattern, but targets the private chat-attachments bucket
// under `${userId}/...` (its storage RLS is owner-path scoped, so the path's
// first segment must be the uploader's own uid — voice notes nest one level
// deeper as `${userId}/voice/...`, still uid-first). Returns the storage
// `path`, never a public URL — the bucket is private and a stored URL would go
// stale; the chat message routes re-sign a fresh URL per-request from the path.
export async function POST(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  // Anti-abuse on storage, same cadence as the feed's media upload cap.
  const limited = await enforceRateLimit("chat-attachment-upload", user.id, request, 30, 300);
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return fail("No file uploaded", 400);

    const mimeType = file.type;
    const isImage = IMAGE_TYPES.includes(mimeType);
    const isVideo = VIDEO_TYPES.includes(mimeType);
    const isVoice = VOICE_TYPES.includes(mimeType);
    if (!isImage && !isVideo && !isVoice) return fail("Invalid file type.", 400);

    const maxMb = isVideo ? MAX_VIDEO_MB : isVoice ? MAX_VOICE_MB : MAX_IMAGE_MB;
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return fail(`File size exceeds ${maxMb}MB limit.`, 400);
    }

    let duration: number | undefined;
    if (isVoice) {
      const raw = Number(formData.get("duration"));
      if (Number.isFinite(raw) && raw > 0) {
        duration = Math.min(raw, MAX_VOICE_SECONDS);
      }
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    let contentType = mimeType;
    // audio/mp4 is the canonical MIME for an M4A/AAC container (many mime
    // libraries, including the client's, report m4a files this way) — keep
    // the file extension as .m4a for voice notes rather than the misleading .mp4.
    let ext = isVoice
      ? "m4a"
      : (mimeType.split("/")[1] || "bin").replace("quicktime", "mov").replace("x-m4a", "m4a");

    // Optimize still images to webp (skip gif/heic which sharp may not handle here).
    if (isImage && mimeType !== "image/gif" && mimeType !== "image/heic") {
      try {
        buffer = await sharp(buffer).webp({ quality: 70, effort: 3 }).toBuffer();
        contentType = "image/webp";
        ext = "webp";
      } catch (e) {
        console.warn("sharp optimize failed; uploading original", e);
      }
    }

    // Server-side content moderation (final say over any client-side fast-fail).
    if (isImage) {
      const verdict = await moderateImage(buffer, contentType);
      if (!verdict.allowed) {
        return fail(verdict.reason || "Image rejected by content moderation.", 422);
      }
    }

    const db = createAdminClient();
    const path = isVoice
      ? `${user.id}/voice/${crypto.randomUUID()}.${ext}`
      : `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await db.storage.from(CHAT_ATTACHMENTS_BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (upErr) return fail(upErr.message, 500);

    // A short-lived preview URL so the client can render the bubble immediately,
    // without waiting on a message fetch to re-sign from the stored path.
    const { data: signed } = await db.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    return ok(
      {
        path,
        type: isVideo ? "video" : isVoice ? "voice" : "image",
        size: buffer.length,
        duration,
        previewUrl: signed?.signedUrl ?? null,
      },
      "Attachment uploaded"
    );
  } catch (error) {
    console.error("Error processing chat attachment upload:", error);
    captureRouteError("chat attachment upload failed", { error: String(error) });
    return fail("Failed to process file", 500);
  }
}
