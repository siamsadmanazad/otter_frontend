import { Buffer } from "buffer";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { activeProvider, activeProviderId, providerFor } from "@/lib/storage";
import { isAllowed, limitKey } from "@/lib/ratelimit";
import { moderateImage } from "@/lib/moderation";
import { captureRouteError, timeRoute } from "@/lib/observability";
import { formatCap, maxBytesFor } from "@/lib/media/limits";
import { encodeImageVariants } from "@/lib/media/variants";

const BUCKET = "posts";
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
    // Was a local 10MB/50MB pair. Now the same numbers the signed-upload path
    // enforces (lib/media/limits.ts) -- two routes writing to one bucket with
    // two different ceilings is how a cap gets quietly bypassed by picking the
    // other door.
    const maxBytes = maxBytesFor(isVideo ? "video" : "image");
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File size exceeds ${formatCap(maxBytes)} limit.` },
        { status: 413 }
      );
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    let contentType = mimeType;
    let ext = (mimeType.split("/")[1] || "bin").replace("quicktime", "mov");

    // Re-encoded to two size-capped WebP variants (lib/media/variants.ts) --
    // skip gif/heic, which sharp may not handle here, and which a re-encode
    // would either break (animated gif) or gain nothing from re-deriving twice
    // over (heic is already efficient; the win here is the RESIZE, not the
    // codec, and a still gif is typically already small).
    let thumbPath: string | null = null;
    let thumbUrl: string | null = null;
    let variantWidth: number | null = null;
    let variantHeight: number | null = null;
    let thumbBuffer: Buffer | null = null;
    let thumbSizeBytes: number | null = null;
    if (isImage && mimeType !== "image/gif" && mimeType !== "image/heic") {
      try {
        const variants = await encodeImageVariants(buffer);
        buffer = variants.feed.buffer;
        variantWidth = variants.feed.width;
        variantHeight = variants.feed.height;
        thumbBuffer = variants.thumb.buffer;
        thumbSizeBytes = variants.thumb.buffer.length;
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
      if (thumbBuffer) {
        thumbPath = `${user.id}/${crypto.randomUUID()}_thumb.webp`;
        await store.put(BUCKET, thumbPath, thumbBuffer, "image/webp", "31536000, immutable");
        thumbUrl = store.publicUrl(BUCKET, thumbPath);
      }
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
        width: variantWidth,
        height: variantHeight,
        thumb_path: thumbPath,
        thumb_url: thumbUrl,
        // media-compression-audit item 5: the ONE byte-accounting field this
        // route ever set was on the video branch (isVideo ? ... never set it
        // for images at all -- so a per-owner storage view summing
        // size_bytes would have been blind to every photo, the majority of
        // objects. buffer.length here is post-compression (the object
        // actually being stored), so this is what's really on disk, not the
        // upload's raw size.
        size_bytes: buffer.length,
        thumb_size_bytes: thumbSizeBytes,
      })
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({
      message: "Media uploaded successfully",
      mediaId: media.id,
      url,
      thumbUrl,
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
    .select("id, bucket, path, thumb_path, owner_id, provider")
    .eq("id", id)
    .maybeSingle();
  if (!media || media.owner_id !== user.profileId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  // Deletes follow the ROW's provider, never the current flag -- objects
  // written before a cutover still live on Supabase (MEDIA.md §6.2). The
  // thumb variant (lib/media/variants.ts) is a second object at its own path
  // -- omitting it here would leak it forever, same as DELETE /api/media/[id].
  const paths = [media.path, media.thumb_path].filter((p): p is string => !!p);
  await providerFor(media.provider).remove(media.bucket, paths);
  await db.from("media").delete().eq("id", id);
  return NextResponse.json({ message: "Media deleted", id });
}
