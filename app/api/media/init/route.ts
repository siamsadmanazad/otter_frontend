import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { activeProvider, activeProviderId } from "@/lib/storage";
import { enforceRateLimit } from "@/lib/ratelimit";
import { timeRoute } from "@/lib/observability";

const BUCKET = "posts";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif", "image/heic"];
// MEDIA.md §7: the composer's video path. Narrower than POST /api/media's
// allowlist on purpose -- the client is required to hand us a compressed,
// faststart H.264/AAC MP4 (§7.2), so there is no reason to admit avi/ogg/webm
// here and then discover we cannot read their duration.
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];
// Requested TTL for the presigned upload. Supabase ignores it (fixed 60s
// platform limit); R2 honours it, which is what makes a 25MB video upload on a
// slow connection survivable -- see MEDIA.md §3 G14.
const UPLOAD_TTL_SECONDS = 60 * 60;

// POST /api/media/init  body { mimeType } -> { path, signedUrl, token }
//
// PERFORMANCE.md Phase 5 (P1-2): first half of a direct-to-storage upload
// for IMAGES only -- the client PUTs bytes straight to Storage using the
// returned signed URL, then calls POST /api/media/complete to finish
// processing (WebP re-encode, moderation, insert the media row). The bytes
// never transit this server.
//
// Video is deliberately NOT supported here and stays on the original
// POST /api/media (multipart, synchronous). Supabase's signed upload URLs
// are valid for only ONE MINUTE (a fixed platform limit) -- comfortably
// enough for an image, but a real risk for a 50MB video on a slow
// connection: the upload would silently expire mid-transfer instead of
// just being slow, trading one failure mode for a worse one. Revisit if/when
// video gets real async processing (Phase 8+).
//
// Rate limit shares the same "media" key/budget as POST /api/media -- one
// combined anti-abuse pool across every storage-write path.
//
// composers_implementation.md §9.3 -- this used to also be checked in
// POST /api/media/complete with the SAME key, so every photo cost 2 of the
// budget instead of 1 (one init + one complete per file). A 10-photo post
// cost 20; a second one in the same window failed mid-publish, after some
// photos had already uploaded. Fixed by checking it here ONLY --
// /api/media/complete is unreachable without a signed path this route
// issued, so it isn't an independent abuse surface -- and raising the
// budget to cover two full 10-photo posts plus a few retries.
export const POST = timeRoute("media.init", async (request: NextRequest) => {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit("media", user.id, request, 60, 300);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
  const isImage = IMAGE_TYPES.includes(mimeType);
  const isVideo = VIDEO_TYPES.includes(mimeType);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Unsupported media type." }, { status: 400 });
  }

  // Video is admitted here ONLY on R2. This is not a policy choice, it is the
  // 60-second Supabase ceiling: a 25MB upload that runs past it does not fail
  // loudly, it fails MID-TRANSFER after the user has waited -- strictly worse
  // than being slow. On Supabase, video keeps using the synchronous multipart
  // route it uses today. MEDIA.md §3 G14.
  if (isVideo && activeProviderId() !== "r2") {
    return NextResponse.json(
      { error: "Video uploads use POST /api/media on this deployment." },
      { status: 400 }
    );
  }

  const ext = (mimeType.split("/")[1] || "bin").replace("quicktime", "mov");
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  let ticket;
  try {
    ticket = await activeProvider().createUploadUrl(BUCKET, path, mimeType, UPLOAD_TTL_SECONDS);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create upload URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Upload URL created",
    // `provider`/`uploadUrl`/`method`/`headers` are the new, provider-agnostic
    // shape. `signedUrl` and `token` are kept as aliases so ALREADY-INSTALLED
    // builds -- which only know the Supabase handshake -- keep working after a
    // cutover; on R2 `token` is simply absent and those old clients still hit
    // the Supabase branch of the flag until they update (MEDIA.md §6.3).
    provider: ticket.provider,
    path: ticket.path,
    uploadUrl: ticket.uploadUrl,
    method: ticket.method,
    headers: ticket.headers,
    ttlSeconds: ticket.ttlSeconds,
    signedUrl: ticket.uploadUrl,
    token: ticket.token,
  });
});
