import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// GET /api/saved?page=&limit=  -> the signed-in user's saved posts (newest first)
// Uses the actor client so get_saved_posts can resolve auth.uid().
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "12", 10)));

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_saved_posts", {
      p_page: page,
      p_limit: limit,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Saved posts retrieved successfully");
  } catch (e) {
    console.error("GET /api/saved error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/saved  body { post } -> toggle save -> { isSaved }
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("saved", user.id, request, 30, 60);
    if (limited) return limited;

    const body = await request.json();
    const postId: string | undefined = body.post ?? body.postId;
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_save", { p_post_id: postId });
    if (error) {
      if (error.message.includes("POST_NOT_FOUND")) return fail("Post not found", 404);
      return fail(error.message, 500);
    }
    const isSaved = (data as { isSaved: boolean }).isSaved;
    return ok(data, isSaved ? "Post saved" : "Post unsaved");
  } catch (e) {
    console.error("POST /api/saved error:", e);
    return fail("Internal server error", 500);
  }
}
