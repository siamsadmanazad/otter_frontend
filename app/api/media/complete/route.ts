import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { activeProvider, activeProviderId } from "@/lib/storage";
import { moderateImage } from "@/lib/moderation";
import { captureRouteError, timeRoute } from "@/lib/observability";
import { parseMp4Header } from "@/lib/media/mp4";

const BUCKET = "posts";
// 120s is the product cap (MEDIA.md §7.5). The 5s of slack absorbs the
// difference between what a device's encoder was ASKED for and what it
// actually wrote -- compressors routinely land a frame or two long, and
// rejecting a user's 120.04s clip would be an infuriating bug, not a policy.
const MAX_VIDEO_MS = 125_000;
// A compliant clip is 720p. 1920 leaves room for a device that ignored the
// request without letting a 4K master through.
const MAX_VIDEO_LONG_EDGE = 1920;
// The MP4 header sits at the front of a faststart file. 256KB is generous for
// a moov atom and still a rounding error next to downloading the whole video.
const MP4_HEAD_BYTES = 256 * 1024;
const MP4_TAIL_BYTES = 1024 * 1024;
const VIDEO_EXTENSIONS = ["mp4", "mov"];

// POST /api/media/complete  body { path } -> { mediaId, url }
//
// Finishes an upload started by POST /api/media/init: downloads the raw
// object the client just PUT directly to Storage, re-encodes it to WebP
// (mirroring POST /api/media's own step -- gif/heic skip re-encoding there
// too, since sharp may not handle them, so the raw upload is kept as-is),
// runs the same moderation check, uploads the optimized result to its real
// final path with the same immutable cache header, deletes the raw temp
// object, and inserts the media row -- same shape/behavior as the
// synchronous route, just split across the upload boundary so the raw
// bytes never transited this server.
//
// Known tradeoff vs. the synchronous route: moderation now runs AFTER the
// raw bytes are already sitting in Storage (however briefly), not before --
// an inherent property of any signed-upload pattern, not a bug. A rejected
// image is deleted immediately below.
export const POST = timeRoute("media.complete", async (request: NextRequest) => {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // No rate-limit check here -- composers_implementation.md §9.3. The
  // budget is enforced once, in /api/media/init, which is the only route
  // that can hand out a path this one will accept below.
  const body = await request.json().catch(() => ({}));
  const rawPath = typeof body.path === "string" ? body.path : "";
  // /api/media/init only ever generates paths under the caller's own id;
  // this refuses to process a path that isn't "theirs" even though nothing
  // upstream could have handed one out.
  if (!rawPath || !rawPath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid or missing path" }, { status: 400 });
  }

  const db = createAdminClient();
  const store = activeProvider();

  // The extension was minted by /api/media/init from a validated MIME type, so
  // it is a server-issued fact about the object, not client input.
  const ext = rawPath.split(".").pop()?.toLowerCase() ?? "";
  if (VIDEO_EXTENSIONS.includes(ext)) {
    return completeVideo(db, store, user, rawPath, body);
  }

  try {
    let raw;
    try {
      raw = await store.download(BUCKET, rawPath);
    } catch {
      return NextResponse.json(
        { error: "Upload not found -- it may not have completed yet." },
        { status: 400 }
      );
    }

    let buffer = raw.buffer;
    let contentType = raw.contentType;
    let finalPath = rawPath;

    // Mirrors app/api/media/route.ts's own skip-list exactly.
    if (contentType !== "image/gif" && contentType !== "image/heic") {
      try {
        buffer = await sharp(buffer).webp({ quality: 70, effort: 3 }).toBuffer();
        contentType = "image/webp";
        finalPath = `${user.id}/${crypto.randomUUID()}.webp`;
      } catch (e) {
        console.warn("sharp optimize failed; using the raw upload as-is", e);
      }
    }

    const verdict = await moderateImage(buffer, contentType);
    if (!verdict.allowed) {
      await store.remove(BUCKET, [rawPath]);
      return NextResponse.json(
        { error: verdict.reason || "Image rejected by content moderation." },
        { status: 422 }
      );
    }

    if (finalPath !== rawPath) {
      try {
        await store.put(BUCKET, finalPath, buffer, contentType, "31536000, immutable");
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Upload failed" },
          { status: 500 }
        );
      }
      // Best-effort cleanup of the raw temp object; a leftover raw file next
      // to its processed sibling is a rare, cheap loose end -- not worth
      // failing the whole request over.
      store.remove(BUCKET, [rawPath]).catch(() => {});
    }

    const url = store.publicUrl(BUCKET, finalPath);
    const { data: media, error: insErr } = await db
      .from("media")
      .insert({
        owner_id: user.profileId,
        media_type: "IMAGE",
        bucket: BUCKET,
        path: finalPath,
        // Pinned at write time, never rewritten: deletion routes on THIS, not
        // on whatever MEDIA_PROVIDER says later (MEDIA.md §6.2).
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
    console.error("Error completing upload:", error);
    captureRouteError("media complete failed", { error: String(error) });
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
});

/**
 * Finishes a VIDEO upload (MEDIA.md §7.3).
 *
 * Deliberately unlike the image path in three ways:
 *
 *  1. **The bytes are never fully downloaded.** Only the MP4 header is read, by
 *     range. Pulling a 25MB object into a Vercel function to learn its duration
 *     would cost real function memory and time for ~200 bytes of answer.
 *  2. **Nothing is re-encoded.** Compression happened on the device, where the
 *     CPU is free and the user is waiting anyway. A server-side transcode is
 *     the single biggest thing this architecture avoids -- see MEDIA.md §0.
 *  3. **Moderation rides on the poster.** The poster frame was uploaded through
 *     the ordinary image path, which already ran moderateImage() over it. That
 *     is what takes video moderation from "nothing at all" (the state of the
 *     shipped code -- MEDIA.md §3 G10) to a real check, for no extra work.
 *
 * DURATION IS MEASURED, NEVER BELIEVED. The client tells us nothing here; the
 * number comes out of the file's own mvhd box.
 */
async function completeVideo(
  db: ReturnType<typeof createAdminClient>,
  store: ReturnType<typeof activeProvider>,
  user: { id: string; profileId: string },
  path: string,
  body: Record<string, unknown>
) {
  const reject = async (message: string, status: number) => {
    // A video that fails validation has already been PUT to storage -- inherent
    // to any presigned-upload design -- so the bytes are removed here rather
    // than left for the orphan reaper to find 48h later.
    await store.remove(BUCKET, [path]).catch(() => {});
    return NextResponse.json({ error: message }, { status });
  };

  let header = null as ReturnType<typeof parseMp4Header>;
  let sizeBytes: number | undefined;
  try {
    const head = await store.downloadRange(BUCKET, path, 0, MP4_HEAD_BYTES - 1);
    sizeBytes = head.totalSize;
    header = parseMp4Header(head.buffer);
    if (!header) {
      // No moov atom at the front means the file was not written faststart, so
      // it is at the end instead. Worth one more range read before giving up:
      // such a file still PLAYS, it just cannot start until it is fully
      // buffered, and we would rather accept it than lose the user's upload.
      const tail = await store.downloadRange(BUCKET, path, -MP4_TAIL_BYTES);
      sizeBytes ??= tail.totalSize;
      header = parseMp4Header(tail.buffer);
    }
  } catch {
    return reject("Upload not found -- it may not have completed yet.", 400);
  }

  // width/height of 0 alongside a plausible duration is what a TRUNCATED file
  // looks like (verified against a real clip cut to 100 bytes) -- the mvhd box
  // was reachable but no track header was. Treat it as a failed parse.
  if (!header || header.width <= 0 || header.height <= 0) {
    return reject("That video could not be read. Please try again.", 422);
  }
  if (header.durationMs > MAX_VIDEO_MS) {
    return reject("Videos can be up to 2 minutes.", 422);
  }
  if (Math.max(header.width, header.height) > MAX_VIDEO_LONG_EDGE) {
    return reject("That video is too large. Please try again.", 422);
  }

  // The poster is optional at this layer: a caller may legitimately not have
  // one yet. When given, it must be an IMAGE the SAME profile owns -- otherwise
  // a video could borrow someone else's moderated frame as cover.
  let posterMediaId: string | null = null;
  let posterUrl: string | null = null;
  const rawPoster = typeof body.posterMediaId === "string" ? body.posterMediaId : "";
  if (rawPoster) {
    const { data: poster } = await db
      .from("media")
      .select("id, url, owner_id, media_type")
      .eq("id", rawPoster)
      .maybeSingle();
    if (!poster || poster.owner_id !== user.profileId || poster.media_type !== "IMAGE") {
      return reject("Invalid poster image.", 400);
    }
    posterMediaId = poster.id;
    posterUrl = poster.url;
  }

  const url = store.publicUrl(BUCKET, path);
  const { data: media, error: insErr } = await db
    .from("media")
    .insert({
      owner_id: user.profileId,
      media_type: "VIDEO",
      bucket: BUCKET,
      path,
      provider: activeProviderId(),
      url,
      width: header.width,
      height: header.height,
      duration_ms: header.durationMs,
      size_bytes: sizeBytes ?? null,
      poster_media_id: posterMediaId,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({
    message: "Media uploaded successfully",
    mediaId: media.id,
    url,
    posterUrl,
    width: header.width,
    height: header.height,
    durationMs: header.durationMs,
  });
}
