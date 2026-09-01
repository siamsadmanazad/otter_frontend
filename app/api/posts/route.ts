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
        .order("created_at", { ascending: false })
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

    const placeValidation = await validatePlaceAndAltTexts(db, body, images, genre);
    if ("error" in placeValidation) return fail(placeValidation.error, 400);
    const { placeTrail, topicNicheId } = placeValidation;

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
      if ((!caption || !caption.trim()) && images.length === 0) {
        return fail("Add a body, or at least a title, to your Post", 400);
      }
      // Enrichment cap (D21) -- checked here too so the error is specific;
      // posts_post_images_cap_chk is the DB-level backstop.
      if (images.length > 4) {
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
    } else if (!caption?.trim() && images.length === 0 && !resolvedTitle) {
      return fail("At least one of caption or image is required", 400);
    }

    const { data: inserted, error } = await db
      .from("posts")
      .insert({
        owner_id: user.profileId,
        images,
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
