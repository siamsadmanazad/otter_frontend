import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/repost?owner=<uuid>&page=&limit=  -> posts <owner> has echoed, newest first.
// Public (reposts are visible acts, not bookmarks) — uses the actor client only
// so a signed-in caller's own isReposted state comes back correctly; an
// anonymous caller still gets the list, with isReposted always false.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const owner = sp.get("owner");
    if (!owner?.trim()) return fail("owner is required", 400);
    if (!UUID_RE.test(owner)) return fail("Invalid owner ID format", 400);

    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "15", 10)));

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_user_reposts", {
      p_user_id: owner,
      p_page: page,
      p_limit: limit,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Reposts retrieved successfully");
  } catch (e) {
    console.error("GET /api/repost error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/repost  body { post, comment? } -> toggle echo -> { isReposted, repostCount }
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("repost", user.id, request, 20, 60);
    if (limited) return limited;

    const body = await request.json();
    const postId: string | undefined = body.post ?? body.postId;
    if (!postId?.trim()) return fail("Post ID is required", 400);
    const comment: string | null =
      typeof body.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_repost", {
      p_post_id: postId,
      p_comment: comment,
    });
    if (error) {
      if (error.message.includes("SELF_REPOST")) return fail("You can't echo your own post", 409);
      if (error.message.includes("POST_NOT_FOUND")) return fail("Post not found", 404);
      return fail(error.message, 500);
    }
    const isReposted = (data as { isReposted: boolean }).isReposted;
    return ok(data, isReposted ? "Post echoed" : "Echo removed");
  } catch (e) {
    console.error("POST /api/repost error:", e);
    return fail("Internal server error", 500);
  }
}
