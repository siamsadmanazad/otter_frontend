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
//
// feed_genres.md Phase 4.4: `v=4` serves get_feed_v4 — the blended feed
// (§1.5's slot merge of Moments + Posts). Same graceful-degradation chain,
// one link longer: v4 unavailable falls back to v3, which still falls back
// to v2 exactly as before. `only=MOMENTS|POSTS` is the filter sheet's
// focus-filter lens (D19) — passed straight through to get_feed_v4, which
// already knows how to paginate a single stream; there is no separate lane
// endpoint. v4's cursor is composite ({momentAt, momentId, postScore,
// postId, slotIndex}, §5.3a) — five query params instead of v3's two,
// carried in `nextCursor` exactly the way v3's `cursorAt`/`cursorId` are.

// Business Mode Phase 4.3 -- interleaves live offerings into ONE page's
// worth of already-fetched v4 posts, entirely independent of get_feed_v4's
// own cursor/buffer logic (see 20260827160000_offering_blend_settings.sql
// for why that separation is deliberate, and 20260827170000_offering_
// blend_sample.sql for why the sample is random per call rather than
// reusing search_offerings' recency ordering). Cadence is page-relative,
// not absolute-position: each page/batch restarts its own 1-in-density
// counter rather than tracking a running position across pages, which
// keeps this free of any new pagination state of its own -- the average
// density holds over a long scroll even though exact spacing isn't
// perfectly even across a page boundary, an accepted trade for staying
// out of get_feed_v4's cursor entirely. Spliced items are marked with
// `__feedItemType: "offering"` so the client can distinguish them from a
// plain post; a real post's shape is completely unchanged (no wrapper),
// so this has zero effect on any other consumer of this same array shape.
async function blendOfferings(db: ReturnType<typeof createAdminClient>, posts: any[]) {
  if (posts.length === 0) return posts;
  try {
    const { data: density, error: densityErr } = await db.rpc("offering_blend_density");
    if (densityErr || !density || density <= 0) return posts;

    const slots = Math.floor(posts.length / density);
    if (slots <= 0) return posts;

    const { data: sample, error: sampleErr } = await db.rpc("blend_offerings_sample", {
      p_limit: slots,
    });
    if (sampleErr) throw sampleErr;
    const offerings = (sample as any[]) ?? [];
    if (offerings.length === 0) return posts;

    const blended: any[] = [];
    let nextOffering = 0;
    posts.forEach((post, i) => {
      blended.push(post);
      const position = i + 1; // 1-indexed within this page
      if (position % density === 0 && nextOffering < offerings.length) {
        blended.push({ __feedItemType: "offering", ...offerings[nextOffering] });
        nextOffering++;
      }
    });
    return blended;
  } catch (err) {
    captureRouteError("offering feed blend failed, serving unblended posts", {
      error: err instanceof Error ? err.message : String(err),
    });
    return posts;
  }
}

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
  const wantsV4 = sp.get("v") === "4";
  const wantsV3 = sp.get("v") === "3";
  const clean = (v: string | null) =>
    v && v !== "null" && v !== "undefined" ? v : null;
  const cursorAt = clean(sp.get("cursorAt"));
  const cursorId = clean(sp.get("cursorId"));
  const momentAt = clean(sp.get("momentAt"));
  const momentId = clean(sp.get("momentId"));
  const postScoreRaw = clean(sp.get("postScore"));
  const postScore = postScoreRaw === null ? null : parseFloat(postScoreRaw);
  const postId = clean(sp.get("postId"));
  const slotIndex = parseInt(sp.get("slotIndex") || "0", 10);
  const onlyRaw = clean(sp.get("only"));
  const only = onlyRaw === "MOMENTS" || onlyRaw === "POSTS" ? onlyRaw : null;

  // Shared block-filter so v4/v3/v2 paths behave identically.
  const filterBlocked = async (db: any, posts: any[]) => {
    if (!profileId || posts.length === 0) return posts;
    const blocked = await getBlockedPairIds(db, profileId);
    if (!blocked.length) return posts;
    const set = new Set(blocked);
    return posts.filter((p) => !set.has(p?.owner?.id));
  };

  const db = createAdminClient();

  // --- Phase 4: the blended feed (with graceful fallback through v3 -> v2)
  if (wantsV4 && !(mode === "following" && !!profileId)) {
    try {
      const { data, error } = await db.rpc("get_feed_v4", {
        p_viewer: profileId || null,
        p_moment_at: momentAt,
        p_moment_id: momentId,
        p_post_score: postScore,
        p_post_id: postId,
        p_slot_index: slotIndex,
        p_limit: limit,
        p_only: only,
      });
      if (error) throw error;
      const posts = await filterBlocked(db, (data?.posts as any[]) ?? []);
      // Business Mode Phase 4.3 -- splice live offerings into this PAGE's
      // post array, entirely additive and independent of get_feed_v4's own
      // cursor/buffer logic (see 20260827160000_offering_blend_settings.sql
      // for why that separation is deliberate). Never runs when `only` is
      // set -- a viewer who explicitly asked for just Moments or just Posts
      // does not want offerings mixed into that focused view. Fails open:
      // any error here degrades to the unblended post list, never breaks
      // the feed.
      const blended = only ? posts : await blendOfferings(db, posts);
      return NextResponse.json({
        message: "Received feed data",
        status: 200,
        data: { posts: blended, nextCursor: data?.nextCursor ?? null, served: "v4" },
      });
    } catch (err) {
      captureRouteError("feed v4 unavailable, falling back to v3", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to the existing v3 path below (same request, same
      // response contract v3 already has) rather than duplicating its
      // try/catch — v3's own fallback to v2 still applies underneath it.
    }
  }

  // --- B1: bounded, keyset-paginated "For You" feed (with graceful v2 fallback)
  if ((wantsV4 || wantsV3) && !(mode === "following" && !!profileId)) {
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
