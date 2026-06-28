import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBlockedPairIds } from "@/lib/api/blocks";
import { captureRouteError } from "@/lib/observability";

// GET /api/feed?id=<viewerId>&page=&limit=&mode=foryou|following
//   mode=following -> only posts from accounts the viewer follows (get_following_feed)
//   otherwise      -> personalized "For You" feed w/ public fallback (get_feed_v2)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // Coalesce missing/stringified-undefined ids to null so an unauthenticated or
  // not-yet-resolved viewer gets the public feed instead of a uuid parse error.
  const rawId = sp.get("id");
  const profileId =
    rawId && rawId !== "undefined" && rawId !== "null" ? rawId : null;
  const page = parseInt(sp.get("page") || "1", 10);
  const limit = parseInt(sp.get("limit") || "10", 10);
  const mode = sp.get("mode");

  try {
    const db = createAdminClient();
    // "Following" only makes sense for a signed-in viewer; else fall back.
    const useFollowing = mode === "following" && !!profileId;
    const { data, error } = await db.rpc(
      useFollowing ? "get_following_feed" : "get_feed_v2",
      { p_viewer: profileId || null, p_page: page, p_limit: limit }
    );
    if (error) throw error;

    let posts = (data as any[]) ?? [];
    // Hide posts authored by accounts in a block relationship with the viewer.
    if (profileId) {
      const blocked = await getBlockedPairIds(db, profileId);
      if (blocked.length) {
        const set = new Set(blocked);
        posts = posts.filter((p) => !set.has(p?.owner?.id));
      }
    }
    return NextResponse.json({
      message: "Received feed data",
      status: 200,
      data: posts,
      pagination: {
        currentPage: page,
        postsPerPage: limit,
        totalPosts: posts.length,
        totalPages: page + (posts.length === limit ? 1 : 0),
        hasMore: posts.length === limit,
      },
    });
  } catch (err) {
    console.error("Error fetching feed:", err);
    captureRouteError("feed load failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({
      message: `Failed to load posts: ${err instanceof Error ? err.message : "Unknown error"}`,
      status: 500,
      data: [],
      pagination: { currentPage: 1, postsPerPage: limit, totalPosts: 0, totalPages: 0, hasMore: false },
    });
  }
}
