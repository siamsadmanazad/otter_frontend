import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/search?page=&profile=&group=&shop=&hashtags=
// Returns { users: [{id,username,fullName,profileImage}], hashtags: [{id, hashtags[]}] }
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const profileFilter = sp.get("profile")?.trim() || "";
    const hashtagsFilter = sp.get("hashtags")?.trim() || "";
    const limit = parseInt(sp.get("limit") ?? "10", 10);

    const db = createAdminClient();
    const result: { users: unknown[]; hashtags: unknown[] } = { users: [], hashtags: [] };

    if (profileFilter) {
      const { data } = await db
        .from("profiles")
        .select("id, username, full_name, profile_image")
        .or(`username.ilike.%${profileFilter}%,full_name.ilike.%${profileFilter}%`)
        .limit(limit);
      result.users = ((data ?? []) as any[]).map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        profileImage: u.profile_image,
      }));
    }

    if (hashtagsFilter) {
      const tag = hashtagsFilter.replace(/^#/, "").toLowerCase();
      const { data } = await db
        .from("posts")
        .select("id, hashtags, caption")
        .or(`hashtags.cs.{${tag}},caption.ilike.%${hashtagsFilter}%`)
        .limit(limit);
      result.hashtags = ((data ?? []) as any[]).map((p) => ({ id: p.id, hashtags: p.hashtags ?? [] }));
    }

    return ok(result, "Fetched search results");
  } catch (e) {
    console.error("GET /api/search error:", e);
    return fail("Internal server error", 500);
  }
}
