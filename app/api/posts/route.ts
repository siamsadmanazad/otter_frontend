import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { canViewProfile } from "@/lib/api/visibility";
import { enforceRateLimit } from "@/lib/ratelimit";
import { timeRoute } from "@/lib/observability";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/posts?id=<uuid>  (also accepts ?postId= — legacy) -> single post (IPostProps)
// GET /api/posts?owner=<uuid>&page=&limit= -> that user's posts (newest-first)
export const GET = timeRoute("posts", async (request: NextRequest): Promise<Response> => {
  try {
    const sp = request.nextUrl.searchParams;
    const owner = sp.get("owner");
    if (owner?.trim()) {
      if (!UUID_RE.test(owner)) return fail("Invalid owner ID format", 400);
      const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
      const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "10", 10)));
      const from = (page - 1) * limit;
      const db = createAdminClient();

      // Respect the owner's profile visibility — a non-viewer gets no posts.
      const { data: ownerRow } = await db
        .from("profiles")
        .select("preferences")
        .eq("id", owner)
        .single();
      const viewer = await getServerUser(request);
      const allowed = await canViewProfile(
        db,
        viewer?.id ?? null,
        owner,
        ownerRow?.preferences
      );
      if (!allowed) return ok([], "Profile is private");

      const { data: rows, error: listErr } = await db
        .from("posts")
        .select("id")
        .eq("owner_id", owner)
        // Backdating: a profile is someone's history, so it sorts on WHEN IT
        // HAPPENED. `happened_at` is null for everything not backdated, which
        // is why this coalesces rather than sorting on it directly. The FEED
        // still sorts on created_at -- a backdated Moment is new to your
        // followers even when it is old to you.
        .order("happened_at_effective", { ascending: false })
        .range(from, from + limit - 1);
      if (listErr) return fail(listErr.message, 500);
      const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
      if (ids.length === 0) return ok([], "Posts retrieved successfully");
      // PERFORMANCE.md P0-3: this used to be 1 + N round trips
      // (build_post_json called once per id), each returning the full
      // unbounded likes[]/comments[] arrays -- exactly what get_feed_v3
      // fixed for the main feed and never propagated here. One batch call,
      // bounded per-post shape, order preserved by p_ids' own order.
      const { data: built, error: builtErr } = await db.rpc("feed_posts_slim", {
        p_ids: ids,
        p_viewer: viewer?.id ?? null,
        p_reason: "profile",
      });
      if (builtErr) return fail(builtErr.message, 500);
      return ok((built as unknown[]) ?? [], "Posts retrieved successfully");
    }

    const postId = sp.get("id") ?? sp.get("postId");
    if (!postId?.trim()) return fail("Post ID is required", 400);
    if (!UUID_RE.test(postId)) return fail("Invalid post ID format", 400);

    const db = createAdminClient();
    const viewer = await getServerUser(request);
    const { data, error } = await db.rpc("build_post_json", {
      p_post_id: postId,
      p_viewer: viewer?.id ?? null,
    });
    if (error) return fail(error.message, 500);
    if (!data) return fail("Post not found", 404);
    return ok(data, "Post retrieved successfully");
  } catch (e) {
    console.error("GET /api/posts error:", e);
    return fail("Internal server error", 500);
  }
});

// The three genre values a client may send. feed_genres.md §5.1: `genre` is
// the new, explicit field -- when present it's authoritative. When absent
// (every client shipped before this genre split), the legacy `postType`
// mapping below is used instead, and it can ONLY ever produce MOMENT or
// JOURNAL -- never POST. That's not an oversight: an old client has no genre
// picker, no title field, and no way to send one, so there's nothing for it
// to accidentally create. A stray `postType: 'POST'` from an old build meant
// "photo post" in the old vocabulary and is mapped to MOMENT here, matching
// what that row would have been before this migration set ever ran.
const GENRE_VALUES = new Set(["MOMENT", "JOURNAL", "POST"]);

function resolveGenre(body: Record<string, unknown>): "MOMENT" | "JOURNAL" | "POST" {
  const explicit = typeof body.genre === "string" ? body.genre.toUpperCase() : undefined;
  if (explicit && GENRE_VALUES.has(explicit)) {
    return explicit as "MOMENT" | "JOURNAL" | "POST";
  }
  return body.postType === "JOURNAL" ? "JOURNAL" : "MOMENT";
}

// composers_implementation.md PART 7 M1/M3, §8.1 -- structured place +
// per-photo alt text, additive on top of every existing field. `placeTrail`
// is JOURNAL-only (composers.md §4's Divergence Table); `altTexts` is
// shared by all three genres.
type PlaceTrailEntry = {
  placeId?: string | null;
  name: string;
  lat: number;
  lng: number;
  h3: string;
};

// Validates the place/altText fields that apply to every genre alike --
// separated from the POST-specific block below so each genre's rules read
// as its own list (§8.1's own stated goal for this route).
async function validatePlaceAndAltTexts(
  db: ReturnType<typeof createAdminClient>,
  body: Record<string, unknown>,
  images: string[],
  genre: "MOMENT" | "JOURNAL" | "POST"
): Promise<{ error: string } | { placeTrail: PlaceTrailEntry[]; topicNicheId: string | null }> {
  const altTexts: string[] = Array.isArray(body.altTexts) ? (body.altTexts as string[]) : [];
  if (altTexts.length > 0 && altTexts.length !== images.length) {
    return { error: "Alt text must be provided for every photo or none" };
  }

  const placeId = typeof body.placeId === "string" ? body.placeId : null;
  const placeName = typeof body.placeName === "string" ? body.placeName.trim() : null;
  const placeLat = typeof body.placeLat === "number" ? body.placeLat : null;
  const placeLng = typeof body.placeLng === "number" ? body.placeLng : null;
  const h3Index = typeof body.h3Index === "string" ? body.h3Index : null;
  // All-or-none, mirroring posts_place_coords_chk -- a clear 400 beats the
  // raw constraint-violation string.
  const placeFields = [placeName, placeLat, placeLng, h3Index];
  const placeFieldsSet = placeFields.filter((f) => f !== null && f !== "").length;
  if (placeFieldsSet > 0 && placeFieldsSet < placeFields.length) {
    return { error: "Invalid place coordinates" };
  }
  if (placeId) {
    if (!h3Index) return { error: "Invalid place coordinates" };
    const { data: placeRow } = await db
      .from("radar_places")
      .select("id")
      .eq("id", placeId)
      .eq("is_active", true)
      .maybeSingle();
    if (!placeRow) return { error: "That place no longer exists" };
  }

  const placeTrailRaw = Array.isArray(body.placeTrail) ? (body.placeTrail as PlaceTrailEntry[]) : [];
  if (placeTrailRaw.length > 0 && genre !== "JOURNAL") {
    return { error: "Only a Journal can have a place trail" };
  }
  if (placeTrailRaw.length > 5) {
    return { error: "A place trail can carry at most 5 places" };
  }

  // M4 (composers_implementation.md) -- the topic lane, POST-only.
  const topicNicheId = typeof body.topicNicheId === "string" ? body.topicNicheId : null;
  if (topicNicheId) {
    if (genre !== "POST") return { error: "Only a Post can have a topic" };
    const { data: nicheRow } = await db
      .from("niches")
      .select("id")
      .eq("id", topicNicheId)
      .eq("is_active", true)
      .maybeSingle();
    if (!nicheRow) return { error: "That topic no longer exists" };
  }

  return { placeTrail: placeTrailRaw, topicNicheId };
}


// ── MEDIA.md P5.1 · the post's media list ────────────────────────────────────
//
// A post's media arrives as a list of **media ids**, never as objects. By the
// time a composer publishes it already knows each item's url, dimensions and
// duration -- and every one of those is attacker-controlled if we write what
// the client sends. `/api/media/complete` already measured the truth (duration
// out of the file's own mvhd box, never believed from the client) and stored it
// on the row; this reads it back out rather than re-accepting it over the wire.
//
// A post may carry AT MOST ONE VIDEO. Not a schema limit -- `posts.media` is an
// array and would hold ten -- but a playback one: §7.4 allows exactly one
// active video controller app-wide, so a second video in the same card could
// never play without stopping the first. One video, any number of photos
// beside it, is the shape the player can actually honour.
const MAX_POST_VIDEOS = 1;

type PostMediaEntry = {
  type: "IMAGE" | "VIDEO";
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  provider: string;
  mediaId: string;
};

/**
 * Resolves `body.media` (media ids) into the `posts.media` jsonb, and returns
 * the poster urls that must be appended to `posts.images`.
 *
 * THE DO-NO-HARM RULE (MEDIA.md §7.1) is implemented here and nowhere else: a
 * video's POSTER url goes into `images`, so a build that predates the `media`
 * column renders a still frame instead of an empty card. The video url itself
 * is deliberately never written there -- an old client would try to render it
 * as an <img>.
 */
async function resolvePostMedia(
  db: ReturnType<typeof createAdminClient>,
  body: Record<string, unknown>,
  profileId: string,
  maxItems: number
): Promise<{ error: string } | { media: PostMediaEntry[]; posterUrls: string[] }> {
  const raw = body.media;
  if (raw === undefined || raw === null) return { media: [], posterUrls: [] };
  if (!Array.isArray(raw)) return { error: "media must be a list of media ids" };
  if (raw.length === 0) return { media: [], posterUrls: [] };

  const ids = raw.filter((v): v is string => typeof v === "string" && UUID_RE.test(v));
  if (ids.length !== raw.length) return { error: "media must be a list of media ids" };
  if (new Set(ids).size !== ids.length) return { error: "That media is attached twice" };
  if (ids.length > maxItems) {
    return { error: `This post can carry at most ${maxItems} items` };
  }

  const { data: rows, error } = await db
    .from("media")
    .select("id, owner_id, media_type, url, provider, width, height, duration_ms, poster_media_id")
    .in("id", ids);
  if (error) return { error: error.message };

  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
  // Posters are fetched in one extra round trip rather than through a join, so
  // a poster row that has since been deleted degrades to "no poster" instead of
  // dropping the whole video.
  const posterIds = (rows ?? [])
    .map((r) => r.poster_media_id as string | null)
    .filter((v): v is string => typeof v === "string");
  const posterById = new Map<string, { url: string }>();
  if (posterIds.length > 0) {
    const { data: posters } = await db.from("media").select("id, url").in("id", posterIds);
    for (const p of posters ?? []) posterById.set(p.id as string, { url: p.url as string });
  }

  const media: PostMediaEntry[] = [];
  const posterUrls: string[] = [];
  let videos = 0;

  // Iterated in the order the CLIENT sent, not the order Postgres returned --
  // media order is the author's composition and `.in()` makes no promise.
  for (const id of ids) {
    const row = byId.get(id);
    // Ownership is the whole authorisation check: without it a post could
    // mount someone else's moderated media by id alone.
    if (!row || row.owner_id !== profileId) return { error: "That media is no longer available" };

    const isVideo = row.media_type === "VIDEO";
    if (isVideo && ++videos > MAX_POST_VIDEOS) {
      return { error: "A post can carry one video" };
    }

    const posterUrl = isVideo
      ? posterById.get((row.poster_media_id as string) ?? "")?.url ?? null
      : null;
    // A video with no readable poster is refused rather than published: the
    // feed cannot draw a video tile without one (§3 G9), and `images` would
    // get nothing, which is exactly the empty card the do-no-harm rule exists
    // to prevent.
    if (isVideo && !posterUrl) return { error: "That video has no cover frame" };
    if (posterUrl) posterUrls.push(posterUrl);

    media.push({
      type: isVideo ? "VIDEO" : "IMAGE",
      url: row.url as string,
      posterUrl,
      width: (row.width as number | null) ?? null,
      height: (row.height as number | null) ?? null,
      durationMs: (row.duration_ms as number | null) ?? null,
      provider: (row.provider as string | null) ?? "supabase",
      mediaId: row.id as string,
    });
  }

  return { media, posterUrls };
}

// POST /api/posts -> create post (owner = authenticated user)
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // feed_genres.md Phase 10.1 -- post creation had no rate limit at all
    // (predates the genre split), and a genre=POST row needs no image/upload
    // step, which lowers the cost of spamming it far below a MOMENT/JOURNAL.
    const limited = await enforceRateLimit("posts_create", user.id, request, 10, 300);
    if (limited) return limited;

    const body = await request.json();
    const images: string[] = Array.isArray(body.image) ? body.image : body.images ?? [];
    const caption: string | undefined = body.caption;
    const genre = resolveGenre(body);
    const tribeId: string | null = body.fromGroup ?? body.tribeId ?? null;
    const db = createAdminClient();

    // MEDIA.md P5.1. The per-genre cap is the genre's own photo cap, because
    // the two lists describe the same tray: `posts_post_images_cap_chk` counts
    // `images`, and a video's poster lands there, so a POST carrying a video
    // plus four photos would violate it. Capping `media` at the same number
    // keeps the two in step and produces a specific error instead of a raw
    // constraint violation.
    const mediaCap = genre === "POST" ? 4 : 10;
    const mediaResolution = await resolvePostMedia(db, body, user.profileId, mediaCap);
    if ("error" in mediaResolution) return fail(mediaResolution.error, 400);
    const { media: postMedia, posterUrls } = mediaResolution;
    // The do-no-harm append (§7.1). Poster urls join `images` so that an
    // installed build with no knowledge of `media` still renders a still frame.
    // A poster already present -- a composer that uploaded it as a photo too --
    // is not added twice.
    const imagesWithPosters = [...images, ...posterUrls.filter((u) => !images.includes(u))];

    // Alt text is validated against the FINAL images array, posters included,
    // not against the photos alone: `posts_alt_texts_len_chk` requires
    // cardinality(alt_texts) to be 0 or exactly cardinality(images), so a
    // composer that describes its photos but not its video's cover frame would
    // hit a raw constraint violation. Appending a blank filler here instead
    // would satisfy the constraint by shipping an undescribed tile, which is
    // the a11y bug the constraint exists to prevent -- so the composer is
    // required to describe the cover frame, and the poster is appended LAST so
    // its alt text is simply the last element.
    const placeValidation = await validatePlaceAndAltTexts(db, body, imagesWithPosters, genre);
    if ("error" in placeValidation) return fail(placeValidation.error, 400);
    const { placeTrail, topicNicheId } = placeValidation;

    // bussinesstemplate.md D4 -- the JOURNAL genre is EXPLORER-only. A
    // business keeps Moment and Post (G1: listings alone give a host no
    // organic reach), but a travelogue is a traveller's form. One indexed
    // lookup, and only on the genre that needs it. The DB trigger
    // posts_reject_journal_for_business is the backstop for anything that
    // reaches PostgREST directly.
    if (genre === "JOURNAL") {
      const { data: actor } = await db
        .from("profiles")
        .select("kind")
        .eq("id", user.profileId)
        .maybeSingle();
      if (actor?.kind === "BUSINESS") {
        return fail("A business profile can't publish a Journal", 403);
      }
    }

    // Title -- required non-empty for POST, optional for JOURNAL (M5),
    // forbidden for MOMENT (posts_title_by_genre_chk mirrors this exactly).
    const rawTitle: string | undefined = typeof body.title === "string" ? body.title : undefined;
    let resolvedTitle: string | null = null;
    if (genre === "POST") {
      // Posts are title-led (feed_genres.md §1.2/§5.2).
      if (!rawTitle || !rawTitle.trim()) {
        return fail("A Post needs a title", 400);
      }
      resolvedTitle = rawTitle.trim();
    } else if (genre === "JOURNAL") {
      if (rawTitle?.trim()) resolvedTitle = rawTitle.trim();
    } else if (rawTitle?.trim()) {
      return fail("A Moment can't have a title", 400);
    }
    // feed_genres.md Phase 10.1 -- posts_title_length_chk is the DB-level
    // backstop, same defence-in-depth pattern as every other check here.
    if (resolvedTitle && resolvedTitle.length > 300) {
      return fail("A title can be at most 300 characters", 400);
    }

    // M6 -- trip window, JOURNAL-only, both-or-neither, ordered.
    // Backdating (MOMENT-only): "when this happened", distinct from
    // created_at, which stays honest about when it was published. Bounds
    // mirror posts_happened_at_range_chk exactly.
    let happenedAt: string | null = null;
    if (body.happenedAt != null) {
      if (typeof body.happenedAt !== "string") {
        return fail("happenedAt must be an ISO date string", 400);
      }
      if (genre !== "MOMENT") {
        return fail("Only a Moment can be backdated", 400);
      }
      const when = new Date(body.happenedAt);
      if (Number.isNaN(when.getTime())) return fail("happenedAt is not a valid date", 400);
      if (when.getTime() > Date.now()) return fail("A moment can't have happened in the future", 400);
      if (when.getTime() < Date.parse("2000-01-01T00:00:00Z")) {
        return fail("That date is too far in the past", 400);
      }
      happenedAt = when.toISOString();
    }

    const tripStart: string | null = typeof body.tripStart === "string" ? body.tripStart : null;
    const tripEnd: string | null = typeof body.tripEnd === "string" ? body.tripEnd : null;
    if ((tripStart || tripEnd) && genre !== "JOURNAL") {
      return fail("Only a Journal can have trip dates", 400);
    }
    if ((tripStart === null) !== (tripEnd === null)) {
      return fail("A trip needs both a start and an end date", 400);
    }
    if (tripStart && tripEnd && tripEnd < tripStart) {
      return fail("Trip end can't be before the start", 400);
    }

    if (genre === "POST") {
      if ((!caption || !caption.trim()) && imagesWithPosters.length === 0) {
        return fail("Add a body, or at least a title, to your Post", 400);
      }
      // Enrichment cap (D21) -- checked here too so the error is specific;
      // posts_post_images_cap_chk is the DB-level backstop.
      if (imagesWithPosters.length > 4) {
        return fail("A Post can carry at most 4 photos", 400);
      }
      // Posts are always public content -- never inside a private tribe
      // (feed_genres.md §1.6/§5.2). Checked proactively here for a clean
      // error message; posts_reject_post_genre_in_private_tribe_trg is the
      // database-level backstop (defence in depth, same precedent as the
      // profile-visibility check existing both in canViewProfile() and RLS).
      if (tribeId) {
        const { data: tribeRow } = await db
          .from("tribes")
          .select("privacy")
          .eq("id", tribeId)
          .single();
        if (tribeRow && tribeRow.privacy !== "PUBLIC") {
          return fail("Posts can't be created inside a private tribe", 403);
        }
      }
    } else if (!caption?.trim() && imagesWithPosters.length === 0 && !resolvedTitle) {
      return fail("At least one of caption or image is required", 400);
    }

    const { data: inserted, error } = await db
      .from("posts")
      .insert({
        owner_id: user.profileId,
        images: imagesWithPosters,
        media: postMedia,
        alt_texts: Array.isArray(body.altTexts) ? body.altTexts : [],
        caption: caption ?? null,
        title: resolvedTitle,
        link: genre === "POST" ? body.link ?? null : null,
        location: body.location ?? null,
        place_id: typeof body.placeId === "string" ? body.placeId : null,
        place_name: typeof body.placeName === "string" ? body.placeName.trim() : null,
        place_lat: typeof body.placeLat === "number" ? body.placeLat : null,
        place_lng: typeof body.placeLng === "number" ? body.placeLng : null,
        h3_index: typeof body.h3Index === "string" ? body.h3Index : null,
        place_trail: placeTrail,
        topic_niche_id: topicNicheId,
        trip_start: tripStart,
        trip_end: tripEnd,
        happened_at: happenedAt,
        post_type: genre,
        tribe_id: tribeId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.message.includes("POST_GENRE_REQUIRES_PUBLIC_TRIBE")) {
        return fail("Posts can't be created inside a private tribe", 403);
      }
      return fail(error.message, 500);
    }

    const { data: post } = await db.rpc("build_post_json", {
      p_post_id: inserted.id,
      p_viewer: user.profileId,
    });
    return ok(post, "Post uploaded!");
  } catch (e) {
    console.error("POST /api/posts error:", e);
    return fail("Error uploading post", 500);
  }
}

// PATCH /api/posts -> update own post caption/location
export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { postId, caption, location } = await request.json();
    if (!postId) return fail("Post ID is required for update.", 400);
    if (caption === undefined && location === undefined) {
      return fail("No updateable fields provided (caption or location).", 400);
    }
    const update: Record<string, unknown> = {};
    if (caption !== undefined) update.caption = caption;
    if (location !== undefined) update.location = location;

    const db = createAdminClient();
    const { data, error } = await db
      .from("posts")
      .update(update)
      .eq("id", postId)
      .eq("owner_id", user.profileId)
      .select("id")
      .single();
    if (error || !data) return fail("Post not found.", 404);

    const { data: post } = await db.rpc("build_post_json", {
      p_post_id: postId,
      p_viewer: user.profileId,
    });
    return ok(post, "Post updated successfully!");
  } catch (e) {
    console.error("PATCH /api/posts error:", e);
    return fail("Error updating post", 500);
  }
}

// DELETE /api/posts?id=<uuid> -> delete own post
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const postId = request.nextUrl.searchParams.get("id");
    if (!postId) return fail("Post ID is required for deletion.", 400);

    const db = createAdminClient();
    const { data, error } = await db
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("owner_id", user.profileId)
      .select("id")
      .single();
    if (error || !data) return fail("Post not found.", 404);
    return ok({ id: postId }, "Post deleted successfully!");
  } catch (e) {
    console.error("DELETE /api/posts error:", e);
    return fail("Error deleting post", 500);
  }
}
