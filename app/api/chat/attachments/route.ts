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
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif", "image/heic"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/mpeg", "video/quicktime", "video/x-msvideo"];
const SIGNED_URL_TTL_SECONDS = 60 * 60;

// POST /api/chat/attachments (FormData { file }) -> upload a photo/video for a chat
// message. Mirrors app/api/media/route.ts's validation/upload pattern, but targets the
// private chat-attachments bucket under `${userId}/...` (its storage RLS is owner-path
// scoped, so the path's first segment must be the uploader's own uid). Returns the
// storage `path`, never a public URL — the bucket is private and a stored URL would go
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
    if (!isImage && !isVideo) return fail("Invalid file type.", 400);

    const maxBytes = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;
    if (file.size > maxBytes) {
      return fail(`File size exceeds ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB}MB limit.`, 400);
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    let contentType = mimeType;
    let ext = (mimeType.split("/")[1] || "bin").replace("quicktime", "mov");

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
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
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
        type: isVideo ? "video" : "image",
        size: buffer.length,
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
