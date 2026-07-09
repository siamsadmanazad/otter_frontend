import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBlockedPairIds } from "@/lib/api/blocks";
import { captureRouteError } from "@/lib/observability";

// GET /api/feed?id=<viewerId>&page=&limit=&mode=foryou|following
//   mode=following -> only posts from accounts the viewer follows (get_following_feed)
//   otherwise      -> personalized "For You" feed w/ public fallback (get_feed_v2)
//
// Scale plan B1: when the client sends `v=3` (For You only), serve get_feed_v3 —
// bounded payload (counts + likedByViewer + top-2 comments, not full arrays) +
// keyset cursor pagination. Response shape becomes `data: { posts, nextCursor,
// served }`. If get_feed_v3 isn't deployed yet, we GRACEFULLY FALL BACK to the
// page-based v2 (served:"v2", nextCursor:null) so the feed never breaks — the
// client keys off `served` to pick cursor- vs page-pagination.
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
  const wantsV3 = sp.get("v") === "3";
  const clean = (v: string | null) =>
    v && v !== "null" && v !== "undefined" ? v : null;
  const cursorAt = clean(sp.get("cursorAt"));
  const cursorId = clean(sp.get("cursorId"));

  // Shared block-filter so v3 and v2 paths behave identically.
  const filterBlocked = async (db: any, posts: any[]) => {
    if (!profileId || posts.length === 0) return posts;
    const blocked = await getBlockedPairIds(db, profileId);
    if (!blocked.length) return posts;
    const set = new Set(blocked);
    return posts.filter((p) => !set.has(p?.owner?.id));
  };

  const db = createAdminClient();

  // --- B1: bounded, keyset-paginated "For You" feed (with graceful v2 fallback)
  if (wantsV3 && !(mode === "following" && !!profileId)) {
    try {
      const { data, error } = await db.rpc("get_feed_v3", {
        p_viewer: profileId || null,
        p_cursor_at: cursorAt,
        p_cursor_id: cursorId,
        p_limit: limit,
      });
      if (error) throw error;
      const posts = await filterBlocked(db, (data?.posts as any[]) ?? []);
      return NextResponse.json({
        message: "Received feed data",
        status: 200,
        data: { posts, nextCursor: data?.nextCursor ?? null, served: "v3" },
      });
    } catch (err) {
      // get_feed_v3 not deployed yet (or errored) -> degrade to v2, page-based.
      captureRouteError("feed v3 unavailable, falling back to v2", {
        error: err instanceof Error ? err.message : String(err),
      });
      const { data, error } = await db.rpc("get_feed_v2", {
        p_viewer: profileId || null,
        p_page: page,
        p_limit: limit,
      });
      if (error) throw error;
      const posts = await filterBlocked(db, (data as any[]) ?? []);
      return NextResponse.json({
        message: "Received feed data",
        status: 200,
        data: {
          posts,
          nextCursor: null,
          served: "v2",
          hasMore: posts.length === limit,
        },
      });
    }
  }

  try {
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
