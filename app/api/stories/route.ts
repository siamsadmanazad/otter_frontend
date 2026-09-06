import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// docs/stories.md Phase 1 — the composer's publish endpoint, plus the tray
// read (0.5). All mutation goes through the actor (RLS) client, never the
// admin client: stories_insert_owner/_delete_owner_or_tribe_creator already
// encode every authorship + tribe-membership rule this route would otherwise
// have to re-derive, and story_tray()/keep_story() are SECURITY DEFINER RPCs
// that need a real auth.uid() to resolve current_profile_id() correctly.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIENCE_MODES = new Set(["EVERYONE", "FOLLOWERS", "GROUP"]);

// stories_media_pair_chk requires media_path and media_url together (the
// purge job clears both at once). /api/media's response never carries the
// storage path (feed_repository.uploadImage, reused here unmodified per
// stories.md 1.1's "do not build a parallel upload path", only ever returns
// `url`) -- so it's recovered here from Supabase's own public-URL shape
// rather than widening that shared upload contract for one caller.
const STORAGE_PATH_RE = /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/;
function derivePathFromUrl(url: string): string | null {
  const m = url.match(STORAGE_PATH_RE);
  return m ? decodeURIComponent(m[1]) : null;
}

// ── MEDIA.md P7 · a story from a media ROW, not a url ───────────────────────
//
// The url-shaped body above is the ORIGINAL contract and stays supported for
// every already-installed build. It has two limits this one does not:
//
//  1. It cannot express video at all — media_kind, the poster pair and the
//     measured duration have nowhere to come from.
//  2. `derivePathFromUrl` only understands a SUPABASE public url. Once
//     MEDIA_PROVIDER flips to r2 the upload returns a media.tripotter.net url
//     that matches nothing, and an old client's story publish fails with
//     "Could not resolve that photo" — so this path is also what keeps
//     stories working across the cutover.
//
// Resolving a media id server-side is the same rule /api/posts already
// follows: url, path, kind, poster and duration are read off the row the
// server itself wrote in /api/media/complete, never accepted over the wire.
type ResolvedStoryMedia = {
  media_url: string;
  media_path: string;
  media_kind: "IMAGE" | "VIDEO";
  poster_url: string | null;
  poster_path: string | null;
  duration_ms: number | null;
};

async function resolveStoryMedia(
  mediaId: string,
  profileId: string
): Promise<{ error: string } | { media: ResolvedStoryMedia }> {
  const db = createAdminClient();
  const { data: row, error } = await db
    .from("media")
    .select("id, owner_id, media_type, url, path, duration_ms, poster_media_id")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) return { error: error.message };
  // Ownership IS the authorisation check: without it a story could mount
  // someone else's (possibly moderated-away) media by id alone.
  if (!row || row.owner_id !== profileId) {
    return { error: "That upload is no longer available" };
  }

  const isVideo = row.media_type === "VIDEO";
  if (!isVideo) {
    return {
      media: {
        media_url: row.url as string,
        media_path: row.path as string,
        media_kind: "IMAGE",
        poster_url: null,
        poster_path: null,
        duration_ms: null,
      },
    };
  }

  const posterId = row.poster_media_id as string | null;
  if (!posterId) return { error: "That video has no cover frame" };
  const { data: poster } = await db
    .from("media")
    .select("id, owner_id, url, path")
    .eq("id", posterId)
    .maybeSingle();
  // stories_video_needs_poster_chk would reject this insert anyway; refusing
  // here turns a raw constraint string into copy the composer can show.
  if (!poster || poster.owner_id !== profileId) {
    return { error: "That video has no cover frame" };
  }

  return {
    media: {
      media_url: row.url as string,
      media_path: row.path as string,
      media_kind: "VIDEO",
      poster_url: poster.url as string,
      poster_path: poster.path as string,
      duration_ms: (row.duration_ms as number | null) ?? null,
    },
  };
}

// GET /api/stories?tray=1[&limit=] -> story_tray()
// GET /api/stories?author=<uuid> -> story_segments() (Phase 2, the viewer's
// data source) -- one author's live segments in playback order.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const sp = request.nextUrl.searchParams;
    const supabase = await createActorClient(request);

    if (sp.get("tray") === "1") {
      const limit = Math.min(60, Math.max(1, parseInt(sp.get("limit") || "30", 10)));
      const { data, error } = await supabase.rpc("story_tray", { p_limit: limit });
      if (error) return fail(error.message, 500);
      return ok(data ?? [], "Tray retrieved");
    }

    const author = sp.get("author");
    if (author) {
      if (!UUID_RE.test(author)) return fail("Invalid author ID", 400);
      const { data, error } = await supabase.rpc("story_segments", { p_author: author });
      if (error) return fail(error.message, 500);
      return ok(data ?? [], "Segments retrieved");
    }

    return fail("Unsupported query", 400);
  } catch (e) {
    console.error("GET /api/stories error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/stories -> publish one story segment.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // Stories multiply media volume more than any feature shipped so far
    // (stories.md G8) -- a tighter budget than /api/media's own 30/5min, keyed
    // on the human so switching to a business profile doesn't reset it.
    const limited = await enforceRateLimit("stories_create", user.id, request, 15, 600);
    if (limited) return limited;

    const body = await request.json();

    // Two accepted shapes, newest first: a media id the server resolves, or
    // the original url+path pair. See resolveStoryMedia's own doc for why
    // both exist and why the id one is the only path that can carry video.
    let resolved: ResolvedStoryMedia;
    const mediaId: string | undefined = body.mediaId;
    if (typeof mediaId === "string" && mediaId.trim()) {
      if (!UUID_RE.test(mediaId)) return fail("Invalid media ID", 400);
      const outcome = await resolveStoryMedia(mediaId, user.profileId);
      if ("error" in outcome) return fail(outcome.error, 400);
      resolved = outcome.media;
    } else {
      const mediaUrl: string | undefined = body.mediaUrl;
      if (!mediaUrl || !mediaUrl.trim()) return fail("A photo is required", 400);
      const mediaPath: string | null = body.mediaPath || derivePathFromUrl(mediaUrl);
      if (!mediaPath) return fail("Could not resolve that photo. Try uploading it again.", 400);
      resolved = {
        media_url: mediaUrl,
        media_path: mediaPath,
        media_kind: "IMAGE",
        poster_url: null,
        poster_path: null,
        duration_ms: null,
      };
    }

    const placeId: string | null = body.placeId || null;
    if (placeId && !UUID_RE.test(placeId)) return fail("Invalid place ID", 400);
    const tribeId: string | null = body.tribeId || null;
    if (tribeId && !UUID_RE.test(tribeId)) return fail("Invalid tribe ID", 400);

    const h3Index: string | null = body.h3Index || null;
    // Mirrors stories_place_needs_h3_chk -- a clean 400 beats a raw
    // constraint-violation string reaching the client.
    if (placeId && !h3Index) return fail("A tagged place needs a location", 400);

    const audienceMode: string = (body.audienceMode || "EVERYONE").toUpperCase();
    if (!AUDIENCE_MODES.has(audienceMode)) return fail("Invalid audience", 400);
    const audienceGroupId: string | null = body.audienceGroupId || null;
    if (audienceMode === "GROUP") {
      if (!audienceGroupId) return fail("Pick a group for a group-only story", 400);
      if (!UUID_RE.test(audienceGroupId)) return fail("Invalid group ID", 400);
    }

    const durationHours = body.durationHours === 48 ? 48 : 24;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase
      .from("stories")
      .insert({
        author_profile_id: user.profileId,
        media_url: resolved.media_url,
        media_path: resolved.media_path,
        media_kind: resolved.media_kind,
        poster_url: resolved.poster_url,
        poster_path: resolved.poster_path,
        duration_ms: resolved.duration_ms,
        alt_text: body.altText || null,
        place_id: placeId,
        h3_index: h3Index,
        h3_index_coarse: body.h3IndexCoarse || null,
        tribe_id: tribeId,
        audience_mode: audienceMode,
        audience_group_id: audienceMode === "GROUP" ? audienceGroupId : null,
        duration_hours: durationHours,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("BUSINESS_CANNOT_USE_GROUP_AUDIENCE")) {
        return fail("A business story can't be limited to a group", 400);
      }
      if (error.message.includes("INVALID_AUDIENCE_GROUP")) {
        return fail("That group isn't yours", 400);
      }
      if (/row-level security|permission denied/i.test(error.message)) {
        return fail("You can't post that story", 403);
      }
      return fail(error.message, 500);
    }

    return ok(data, "Posted");
  } catch (e) {
    console.error("POST /api/stories error:", e);
    return fail("Could not post that", 500);
  }
}

// DELETE /api/stories?id=<uuid> -> remove a story (author/staff/tribe-creator,
// enforced by stories_delete_owner_or_tribe_creator, not this route).
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const id = request.nextUrl.searchParams.get("id");
    if (!id || !UUID_RE.test(id)) return fail("Invalid story ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase
      .from("stories")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error || !data) return fail("Story not found", 404);
    return ok({ id }, "Deleted");
  } catch (e) {
    console.error("DELETE /api/stories error:", e);
    return fail("Internal server error", 500);
  }
}
