import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// POST /api/comment/like  body { comment } -> toggle -> { isActive, count }
// Mirrors /api/intent's POST shape exactly (feed_detail_split.md A4).
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("comment_like", user.id, request, 30, 60);
    if (limited) return limited;

    const body = await request.json();
    const commentId: string | undefined = body.comment ?? body.commentId;
    if (!commentId?.trim()) return fail("Comment ID is required", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_comment_like", {
      p_comment_id: commentId,
    });
    if (error) {
      if (error.message.includes("COMMENT_NOT_FOUND")) return fail("Comment not found", 404);
      return fail(error.message, 500);
    }
    const isActive = (data as { isActive: boolean }).isActive;
    return ok(data, isActive ? "Comment liked" : "Comment unliked");
  } catch (e) {
    console.error("POST /api/comment/like error:", e);
    return fail("Internal server error", 500);
  }
}
