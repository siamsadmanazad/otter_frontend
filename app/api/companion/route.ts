import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/companion?userId=&page=&limit= -> suggested users (people you don't already follow)
// Returns the legacy nested shape { _id, id, user: { _id, id, ... } } so existing cards work.
export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId");
  const page = parseInt(sp.get("page") || "1", 10);
  const limit = parseInt(sp.get("limit") || "10", 10);
  const from = (page - 1) * limit;
  if (!userId) return fail("userId is required", 400);

  try {
    const db = createAdminClient();
    // ids the user already follows
    const { data: followRows } = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const exclude = [userId, ...((followRows ?? []) as { following_id: string }[]).map((r) => r.following_id)];

    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, username, bio, location, role, profile_image, created_at, updated_at")
      .not("id", "in", `(${exclude.join(",")})`)
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);
    if (error) return fail(error.message, 500);

    const suggested = ((data ?? []) as any[]).map((p) => ({
      _id: p.id,
      id: p.id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      user: {
        _id: p.id,
        id: p.id,
        fullName: p.full_name,
        username: p.username,
        bio: p.bio,
        location: p.location,
        role: p.role,
        profileImage: p.profile_image,
      },
    }));
    return ok(suggested, "Suggested companions");
  } catch (e) {
    console.error("GET /api/companion error:", e);
    return fail("Internal server error", 500);
  }
}
