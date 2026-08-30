import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { canViewProfile } from "@/lib/api/visibility";
import { enforceRateLimit } from "@/lib/ratelimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/posts?id=<uuid>  (also accepts ?postId= — legacy) -> single post (IPostProps)
// GET /api/posts?owner=<uuid>&page=&limit= -> that user's posts (newest-first)
export async function GET(request: NextRequest): Promise<Response> {
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
      const built = await Promise.all(
        ids.map(async (id) => {
          const { data: p } = await db.rpc("build_post_json", {
            p_post_id: id,
            p_viewer: viewer?.id ?? null,
          });
          return p;
        })
      );
      return ok(built.filter(Boolean), "Posts retrieved successfully");
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
}

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

    if (genre === "POST") {
      // Posts are title-led (feed_genres.md §1.2/§5.2) -- the DB constraint
      // enforces this too (posts_title_by_genre_chk), but a clear 400 here
      // beats a raw constraint-violation string reaching the client.
      const title: string | undefined = body.title;
      if (!title || !title.trim()) {
        return fail("A Post needs a title", 400);
      }
      // feed_genres.md Phase 10.1 -- title had no length cap at all (a new
      // field, nothing pre-existing to preserve compat with); posts_title_length_chk
      // is the DB-level backstop, same defence-in-depth pattern as the checks below.
      if (title.trim().length > 300) {
        return fail("A Post title can be at most 300 characters", 400);
      }
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
    } else if (!caption?.trim() && images.length === 0) {
      return fail("At least one of caption or image is required", 400);
    }

    const { data: inserted, error } = await db
      .from("posts")
      .insert({
        owner_id: user.profileId,
        images,
        caption: caption ?? null,
        title: genre === "POST" ? (body.title as string).trim() : null,
        link: genre === "POST" ? body.link ?? null : null,
        location: body.location ?? null,
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
