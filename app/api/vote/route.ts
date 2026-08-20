import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// POST /api/vote  body { post, value } -> toggle_vote -> { myVote, upvoteCount, downvoteCount, score }
// Mirrors /api/reaction's shape exactly (feed_genres.md Phase 3.3). `value`
// is the arrow just tapped (1 = up, -1 = down) -- tapping the same one again
// removes the vote, the other one flips it (toggle_vote's own doc comment).
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // Same limit as /api/reaction -- a vote is exactly as cheap a tap as a like.
    const limited = await enforceRateLimit("vote", user.id, request, 30, 60);
    if (limited) return limited;

    const body = await request.json();
    const postId: string | undefined = body.post ?? body.postId;
    const value = body.value;
    if (!postId?.trim()) return fail("Post ID is required", 400);
    if (value !== 1 && value !== -1) return fail("value must be 1 or -1", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_vote", {
      p_post_id: postId,
      p_value: value,
    });
    if (error) {
      if (error.message.includes("SELF_VOTE")) return fail("You can't vote on your own post", 409);
      if (error.message.includes("NOT_A_POST_GENRE")) return fail("Only Posts can be voted on", 400);
      if (error.message.includes("POST_NOT_FOUND")) return fail("Post not found", 404);
      return fail(error.message, 500);
    }
    return ok(data, "Vote recorded");
  } catch (e) {
    console.error("POST /api/vote error:", e);
    return fail("Internal server error", 500);
  }
}

// GET /api/vote?id=<postId>&page=&limit=  -> upvoters only, paginated (R9 —
// downvoters are never listed by any endpoint; get_post_upvoters only ever
// selects value=1 rows, and RLS backs that up at the table level too).
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const postId = sp.get("id") ?? sp.get("postId");
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_post_upvoters", {
      p_post_id: postId,
      p_page: page,
      p_limit: limit,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Retrieved upvoters");
  } catch (e) {
    console.error("GET /api/vote error:", e);
    return fail("Internal server error", 500);
  }
}
