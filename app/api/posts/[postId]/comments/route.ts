import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { timeRoute } from "@/lib/observability";

// GET /api/posts/[postId]/comments?page=&limit=&sort=top|new|controversial
// -> top-level comments, each carrying its own
// replyCount/likeCount/downCount/iLiked/myVote. `sort` defaults to 'new'
// (unchanged recency ordering); an unrecognized value falls through
// get_post_comments' own CASE to the 'new' branch, so a bad query param
// degrades to the default rather than erroring (feed_genres.md Phase 5.2).
// GET /api/posts/[postId]/comments?parent=<uuid>&page=&limit=  -> that
// parent's replies, oldest first always (a conversation, not a feed —
// `sort` doesn't apply to replies, feed_detail_split.md F6).
//
// Comments are public read by default, so this never gates on login — an
// anonymous caller gets the same list with iLiked always false (p_viewer
// null). feed_detail_split.md A4/F6. get_post_comments/get_comment_replies
// (both SECURITY DEFINER) now also exclude a HIDDEN/REMOVED comment unless
// p_viewer is its own owner, and either side of a blocks relationship with
// p_viewer — comment moderation, added after this route was first written.
export const GET = timeRoute("posts.comments", async (
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
): Promise<Response> => {
  try {
    const { postId } = await params;
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const sp = request.nextUrl.searchParams;
    const parentId = sp.get("parent");
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
    const sort = sp.get("sort") || "new";

    const user = await getServerUser(request);
    const supabase = await createActorClient(request);

    const { data, error } = parentId
      ? await supabase.rpc("get_comment_replies", {
          p_parent_id: parentId,
          p_viewer: user?.profileId ?? null,
          p_page: page,
          p_limit: limit,
        })
      : await supabase.rpc("get_post_comments", {
          p_post_id: postId,
          p_viewer: user?.profileId ?? null,
          p_page: page,
          p_limit: limit,
          p_sort: sort,
        });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Comments retrieved");
  } catch (e) {
    console.error("GET /api/posts/[postId]/comments error:", e);
    return fail("Internal server error", 500);
  }
});
