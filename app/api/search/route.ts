import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { getBlockedPairIds } from "@/lib/api/blocks";
import { ok, fail, mapTribe, mapPublicUser } from "@/lib/api/http";

// GET /api/search?q=&limit=
// One round trip via the search_all() RPC (pg_trgm-ranked): profiles, public
// tribes, and top-level posts matching the query, all in a single call instead
// of separate per-entity queries. Returns { users, tribes, posts }.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const q = sp.get("q")?.trim() || "";
    const limit = Math.min(parseInt(sp.get("limit") ?? "10", 10) || 10, 50);

    if (!q) return ok({ users: [], tribes: [], posts: [] }, "Fetched search results");

    // Resolved once, up front: search_all's posts bucket needs it to gate a
    // private account's posts (feed_genres.md Phase 1.2 -- previously
    // unfiltered, the worst instance of the feed's privacy-check gap since
    // it's reachable by a fully anonymous caller). null is a valid, correct
    // input -- it means "anonymous", and the RPC only lets PUBLIC posts
    // through for that case.
    const viewer = await getServerUser(request);

    const db = createAdminClient();
    const { data, error } = await db.rpc("search_all", {
      p_query: q,
      p_limit: limit,
      p_viewer: viewer?.id ?? null,
    });
    if (error) throw error;

    const payload = (data ?? {}) as {
      profiles?: Record<string, any>[];
      tribes?: Record<string, any>[];
      posts?: unknown[];
    };

    let users = (payload.profiles ?? []).map((p) => ({ ...mapPublicUser(p), bio: p.bio ?? null }));

    // Drop accounts in a block relationship with the searcher.
    if (viewer) {
      const blocked = new Set(await getBlockedPairIds(db, viewer.id));
      if (blocked.size) users = users.filter((u) => u && !blocked.has(u.id as string));
    }

    const tribes = (payload.tribes ?? []).map(mapTribe);
    const posts = payload.posts ?? [];

    return ok({ users, tribes, posts }, "Fetched search results");
  } catch (e) {
    console.error("GET /api/search error:", e);
    return fail("Internal server error", 500);
  }
}
