import sharp from "sharp";
import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { activeProvider, activeProviderId, providerFor } from "@/lib/storage";
import { isAllowed, limitKey } from "@/lib/ratelimit";
import { moderateImage } from "@/lib/moderation";
import { captureRouteError, timeRoute } from "@/lib/observability";

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
export const POST = timeRoute("media", async (request: NextRequest) => {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Upload cap: 60 / 5 min per user (anti-abuse on storage). Shares the
  // "media" key/budget with /api/media/init (composers_implementation.md
  // §9.3) -- kept in sync with that route's limit.
  const allowed = await isAllowed(limitKey("media", user.id, request), 60, 300);
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
    const store = activeProvider();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    try {
      // PERFORMANCE.md P1-3: every path is an immutable, randomly-generated
      // UUID that is never overwritten, so it gets a year-long immutable
      // cache header. That is also what keeps the CDN hit ratio (and
      // therefore R2's Class B op count) where MEDIA.md §1.1 assumes.
      await store.put(BUCKET, path, buffer, contentType, "31536000, immutable");
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Upload failed" },
        { status: 500 }
      );
    }

    const url = store.publicUrl(BUCKET, path);
    const { data: media, error: insErr } = await db
      .from("media")
      .insert({
        owner_id: user.profileId,
        media_type: isVideo ? "VIDEO" : "IMAGE",
        bucket: BUCKET,
        path,
        provider: activeProviderId(),
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
    captureRouteError("media upload failed", { error: String(error) });
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
});

// DELETE /api/media?id=<mediaId> -> remove from storage + media row (owner-scoped)
export async function DELETE(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Media ID is required" }, { status: 400 });

  const db = createAdminClient();
  const { data: media } = await db
    .from("media")
    .select("id, bucket, path, owner_id, provider")
    .eq("id", id)
    .maybeSingle();
  if (!media || media.owner_id !== user.profileId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  // Deletes follow the ROW's provider, never the current flag -- objects
  // written before a cutover still live on Supabase (MEDIA.md §6.2).
  await providerFor(media.provider).remove(media.bucket, [media.path]);
  await db.from("media").delete().eq("id", id);
  return NextResponse.json({ message: "Media deleted", id });
}
