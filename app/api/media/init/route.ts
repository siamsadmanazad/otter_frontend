import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { enforceRateLimit } from "@/lib/ratelimit";
import { timeRoute } from "@/lib/observability";

const BUCKET = "posts";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "image/gif", "image/heic"];

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
  if (!IMAGE_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Only image uploads use this endpoint; upload video via POST /api/media." },
      { status: 400 }
    );
  }

  const ext = mimeType.split("/")[1] || "bin";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const db = createAdminClient();
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Could not create upload URL" }, { status: 500 });
  }

  return NextResponse.json({
    message: "Upload URL created",
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
  });
});
