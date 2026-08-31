import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/journey?id=<ownerId>&page=&limit= -> that user's JOURNAL posts
// (journals are posts with post_type=JOURNAL), newest-first.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const sp = request.nextUrl.searchParams;
    const ownerId = sp.get("id") || user.profileId;
    // PERFORMANCE.md P1-10: previously a hardcoded .limit(50) with no page
    // param at all -- a user with more than 50 journals could never reach
    // the rest. Same page/limit convention as GET /api/posts?owner=.
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
    const from = (page - 1) * limit;
    const db = createAdminClient();
    const { data } = await db
      .from("posts")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("post_type", "JOURNAL")
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return ok([], "get journals");
    // PERFORMANCE.md P0-3: was 1 + N build_post_json round trips returning
    // the full unbounded likes[]/comments[] arrays. One batch call, bounded
    // per-post shape, order preserved.
    const { data: journals, error } = await db.rpc("feed_posts_slim", {
      p_ids: ids,
      p_viewer: user.profileId,
      p_reason: "journal",
    });
    if (error) return fail(error.message, 500);
    return ok((journals as unknown[]) ?? [], "get journals");
  } catch (e) {
    console.error("GET /api/journey error:", e);
    return fail("Internal server error", 500);
  }
}
