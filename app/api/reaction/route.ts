import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// POST /api/reaction  body { post } -> toggle like -> { isLiked, likeCount, likeId }
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // Anti-spam on like toggling: max 30 / 60s per user.
    const limited = await enforceRateLimit("reaction", user.id, request, 30, 60);
    if (limited) return limited;

    const body = await request.json();
    const postId: string | undefined = body.post ?? body.postId;
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_like", { p_post_id: postId });
    if (error) {
      if (error.message.includes("POST_NOT_FOUND")) return fail("Post not found", 404);
      return fail(error.message, 500);
    }
    const isLiked = (data as { isLiked: boolean }).isLiked;
    return ok(data, isLiked ? "Post liked successfully" : "Post unliked successfully");
  } catch (e) {
    console.error("POST /api/reaction error:", e);
    return fail("Internal server error", 500);
  }
}

// GET /api/reaction?id=<postId>&page=&limit=  (also ?postId=) -> users who
// liked, newest first. Now paginated via get_post_likers (feed_detail_split.md
// A4) — previously an unpaginated raw select with zero Flutter consumer;
// the room's people sheet (D1) is the first real caller.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const postId = sp.get("id") ?? sp.get("postId");
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_post_likers", {
      p_post_id: postId,
      p_page: page,
      p_limit: limit,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Retrieved likes");
  } catch (e) {
    console.error("GET /api/reaction error:", e);
    return fail("Internal server error", 500);
  }
}
