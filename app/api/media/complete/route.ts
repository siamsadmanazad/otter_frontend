import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { moderateImage } from "@/lib/moderation";
import { captureRouteError, timeRoute } from "@/lib/observability";

const BUCKET = "posts";

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

  try {
    const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(rawPath);
    if (dlErr || !blob) {
      return NextResponse.json(
        { error: "Upload not found -- it may not have completed yet." },
        { status: 400 }
      );
    }

    let buffer = Buffer.from(await blob.arrayBuffer());
    let contentType = blob.type || "application/octet-stream";
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
      await db.storage.from(BUCKET).remove([rawPath]);
      return NextResponse.json(
        { error: verdict.reason || "Image rejected by content moderation." },
        { status: 422 }
      );
    }

    if (finalPath !== rawPath) {
      const { error: upErr } = await db.storage.from(BUCKET).upload(finalPath, buffer, {
        contentType,
        upsert: false,
        cacheControl: "31536000, immutable",
      });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      // Best-effort cleanup of the raw temp object; a leftover raw file next
      // to its processed sibling is a rare, cheap loose end -- not worth
      // failing the whole request over.
      db.storage.from(BUCKET).remove([rawPath]).catch(() => {});
    }

    const url = db.storage.from(BUCKET).getPublicUrl(finalPath).data.publicUrl;
    const { data: media, error: insErr } = await db
      .from("media")
      .insert({
        owner_id: user.profileId,
        media_type: "IMAGE",
        bucket: BUCKET,
        path: finalPath,
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
