import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// POST /api/comment/like  body { comment, value? } -> toggle -> { isActive, myVote, likeCount, downCount }
// Path kept as-is (feed_genres.md Phase 5.1: "the table name appears in zero
// TypeScript, so the rename is cheap" -- extends to the route path too;
// existing Flutter builds call this URL). `value` defaults to 1 (a heart) so
// every pre-Phase-5 caller -- which only ever sent { comment } -- keeps
// working unchanged; a Post-genre comment's vote pillar sends -1 explicitly.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("comment_like", user.id, request, 30, 60);
    if (limited) return limited;

    const body = await request.json();
    const commentId: string | undefined = body.comment ?? body.commentId;
    const value = body.value ?? 1;
    if (!commentId?.trim()) return fail("Comment ID is required", 400);
    if (value !== 1 && value !== -1) return fail("value must be 1 or -1", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_comment_vote", {
      p_comment_id: commentId,
      p_value: value,
    });
    if (error) {
      if (error.message.includes("COMMENT_NOT_FOUND")) return fail("Comment not found", 404);
      if (error.message.includes("NOT_A_POST_GENRE"))
        return fail("Only comments on a Post can be downvoted", 400);
      return fail(error.message, 500);
    }
    const isActive = (data as { isActive: boolean }).isActive;
    return ok(data, isActive ? "Comment liked" : "Comment unliked");
  } catch (e) {
    console.error("POST /api/comment/like error:", e);
    return fail("Internal server error", 500);
  }
}
