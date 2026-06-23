import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBlockedPairIds } from "@/lib/api/blocks";
import { captureRouteError } from "@/lib/observability";

// GET /api/feed?id=<viewerId>&page=&limit= -> personalized feed (public fallback) via get_feed_v2 RPC
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // Coalesce missing/stringified-undefined ids to null so an unauthenticated or
  // not-yet-resolved viewer gets the public feed instead of a uuid parse error.
  const rawId = sp.get("id");
  const profileId =
    rawId && rawId !== "undefined" && rawId !== "null" ? rawId : null;
  const page = parseInt(sp.get("page") || "1", 10);
  const limit = parseInt(sp.get("limit") || "10", 10);

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("get_feed_v2", {
      p_viewer: profileId || null,
      p_page: page,
      p_limit: limit,
    });
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
