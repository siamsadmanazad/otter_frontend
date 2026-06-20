import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// POST /api/suggestion?profile=&page=&limit=  body { userId }
// Suggests users near the requester's location. Returns { users: [...] }.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const profileFilter = sp.get("profile");
    const limit = parseInt(sp.get("limit") ?? "10", 10);
    const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };

    const result: { users: unknown[] } = { users: [] };
    if (profileFilter && userId) {
      const db = createAdminClient();
      const { data: me } = await db.from("profiles").select("location").eq("id", userId).maybeSingle();
      if (me?.location) {
        const { data } = await db
          .from("profiles")
          .select("id, username, full_name, profile_image, location, bio, role")
          .ilike("location", `%${me.location}%`)
          .neq("id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);
        result.users = ((data ?? []) as any[]).map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.full_name,
          profileImage: u.profile_image,
          location: u.location,
          bio: u.bio,
          role: u.role,
        }));
      }
    }
    return ok(result, "Suggestions");
  } catch (e) {
    console.error("POST /api/suggestion error:", e);
    return fail("Internal server error", 500);
  }
}
