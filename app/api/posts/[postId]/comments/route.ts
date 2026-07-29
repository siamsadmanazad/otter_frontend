import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/posts/[postId]/comments?page=&limit=  -> top-level comments,
// newest first, each carrying its own replyCount/likeCount/iLiked.
// GET /api/posts/[postId]/comments?parent=<uuid>&page=&limit=  -> that
// parent's replies, oldest first (a conversation, not a feed).
//
// Comments are public read (RLS: comments_select_all), so this never gates
// on login — an anonymous caller gets the same list with iLiked always
// false (p_viewer null). feed_detail_split.md A4/F6.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
): Promise<Response> {
  try {
    const { postId } = await params;
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const sp = request.nextUrl.searchParams;
    const parentId = sp.get("parent");
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));

    const user = await getServerUser(request);
    const supabase = await createActorClient(request);

    const { data, error } = parentId
      ? await supabase.rpc("get_comment_replies", {
          p_parent_id: parentId,
          p_viewer: user?.id ?? null,
          p_page: page,
          p_limit: limit,
        })
      : await supabase.rpc("get_post_comments", {
          p_post_id: postId,
          p_viewer: user?.id ?? null,
          p_page: page,
          p_limit: limit,
        });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Comments retrieved");
  } catch (e) {
    console.error("GET /api/posts/[postId]/comments error:", e);
    return fail("Internal server error", 500);
  }
}
