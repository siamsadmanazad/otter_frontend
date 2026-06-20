import sharp from "sharp";
import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { isAllowed, limitKey } from "@/lib/ratelimit";
import { moderateImage } from "@/lib/moderation";

const BUCKET = "posts";
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif", "image/heic"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/mpeg", "video/quicktime", "video/x-msvideo"];

// GET /api/media?id=<mediaId> -> FLAT { url, altText } (consumed as response.data.url)
export async function GET(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Media ID is required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db.from("media").select("url, path").eq("id", id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  return NextResponse.json({
    message: "Media retrieved successfully",
    url: data.url,
    altText: (data.path as string).split("/").pop()?.split(".")[0] ?? "",
  });
}

// POST /api/media (FormData { file }) -> upload to Supabase Storage -> { mediaId, url }
export async function POST(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Upload cap: 30 / 5 min per user (anti-abuse on storage).
  const allowed = await isAllowed(limitKey("media", user.id, request), 30, 300);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const mimeType = file.type;
    const isImage = IMAGE_TYPES.includes(mimeType);
    const isVideo = VIDEO_TYPES.includes(mimeType);
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "Invalid file type." }, { status: 400 });
    }
    const maxBytes = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB}MB limit.` },
        { status: 400 }
      );
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

    // Server-side content moderation (final say over the client nsfwjs fast-fail).
    // No-op pass unless MODERATION_API_URL is configured; fail-open on errors.
    if (isImage) {
      const verdict = await moderateImage(buffer, contentType);
      if (!verdict.allowed) {
        return NextResponse.json(
          { error: verdict.reason || "Image rejected by content moderation." },
          { status: 422 }
        );
      }
    }

    const db = createAdminClient();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { data: media, error: insErr } = await db
      .from("media")
      .insert({
        owner_id: user.id,
        media_type: isVideo ? "VIDEO" : "IMAGE",
        bucket: BUCKET,
        path,
        url,
      })
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({
      message: "Media uploaded successfully",
      mediaId: media.id,
      url,
    });
  } catch (error) {
    console.error("Error processing file upload:", error);
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}

// DELETE /api/media?id=<mediaId> -> remove from storage + media row (owner-scoped)
export async function DELETE(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Media ID is required" }, { status: 400 });

  const db = createAdminClient();
  const { data: media } = await db
    .from("media")
    .select("id, bucket, path, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!media || media.owner_id !== user.id) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  await db.storage.from(media.bucket).remove([media.path]);
  await db.from("media").delete().eq("id", id);
  return NextResponse.json({ message: "Media deleted", id });
}
