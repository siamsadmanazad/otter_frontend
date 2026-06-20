import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/posts?id=<uuid>  (also accepts ?postId= — legacy) -> single post (IPostProps)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const postId = sp.get("id") ?? sp.get("postId");
    if (!postId?.trim()) return fail("Post ID is required", 400);
    if (!UUID_RE.test(postId)) return fail("Invalid post ID format", 400);

    const db = createAdminClient();
    const { data, error } = await db.rpc("build_post_json", { p_post_id: postId });
    if (error) return fail(error.message, 500);
    if (!data) return fail("Post not found", 404);
    return ok(data, "Post retrieved successfully");
  } catch (e) {
    console.error("GET /api/posts error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/posts -> create post (owner = authenticated user)
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json();
    const images: string[] = Array.isArray(body.image) ? body.image : body.images ?? [];
    const caption: string | undefined = body.caption;
    if ((!caption || !caption.trim()) && images.length === 0) {
      return fail("At least one of caption or image is required", 400);
    }

    const db = createAdminClient();
    const { data: inserted, error } = await db
      .from("posts")
      .insert({
        owner_id: user.id,
        images,
        caption: caption ?? null,
        location: body.location ?? null,
        post_type: body.postType === "JOURNAL" ? "JOURNAL" : "POST",
        tribe_id: body.fromGroup ?? body.tribeId ?? null,
      })
      .select("id")
      .single();
    if (error) return fail(error.message, 500);

    const { data: post } = await db.rpc("build_post_json", { p_post_id: inserted.id });
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
      .eq("owner_id", user.id)
      .select("id")
      .single();
    if (error || !data) return fail("Post not found.", 404);

    const { data: post } = await db.rpc("build_post_json", { p_post_id: postId });
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
      .eq("owner_id", user.id)
      .select("id")
      .single();
    if (error || !data) return fail("Post not found.", 404);
    return ok({ id: postId }, "Post deleted successfully!");
  } catch (e) {
    console.error("DELETE /api/posts error:", e);
    return fail("Error deleting post", 500);
  }
}
