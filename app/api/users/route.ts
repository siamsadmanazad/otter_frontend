import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail, mapProfile } from "@/lib/api/http";
import { buildProfilePayload } from "@/lib/api/profile-payload";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/users?id=<uuid> — public profile + aggregate counts (IUserProfile shape).
// Honors privacy.profileVisibility: non-viewers get a restricted payload (identity
// + counts only, no bio/location/socials) with `restricted: true`.
//
// For "my own profile" use GET /api/users/me instead -- this route's `id` is
// whatever the caller passes, which for a client naively passing its own raw
// auth uid will ALWAYS resolve to that human's EXPLORER row, never a business
// they've switched to act as. /me resolves the id server-side off the JWT's
// acting_profile claim, which is the only correct way to answer "who am I
// right now" (business-mode-plan.md 2.1's on-device gap, found while
// building 2.3).
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = request.nextUrl.searchParams.get("id");
    if (!userId?.trim()) return fail("User ID is required", 400);
    if (!UUID_RE.test(userId)) return fail("Invalid user ID format", 400);

    const result = await buildProfilePayload(userId, request);
    if (!result) return fail("User not found", 404);
    return ok(result.body, "User data retrieved successfully", result.status, result.partial);
  } catch (e) {
    console.error("GET /api/users error:", e);
    return fail("Internal server error", 500);
  }
}

// PATCH /api/users — update own profile (camelCase body -> snake_case columns)
export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json();
    const allowed: Record<string, string> = {
      bio: "bio",
      location: "location",
      socials: "socials",
      fullName: "full_name",
      profileImage: "profile_image",
      coverImage: "cover_image",
    };
    const update: Record<string, unknown> = {};
    for (const [key, col] of Object.entries(allowed)) {
      if (key in body) update[col] = body[key];
    }
    if (Object.keys(update).length === 0) return fail("No updatable fields provided", 400);

    const db = createAdminClient();
    const { data, error } = await db
      .from("profiles")
      .update(update)
      .eq("id", user.profileId)
      .select(
        "id, serial, username, full_name, profile_image, cover_image, bio, location, socials, email, active, role, reputation, kind, created_at, updated_at"
      )
      .single();

    if (error) return fail(error.message, 500);
    return ok(mapProfile(data), "Profile Updated!");
  } catch (e) {
    console.error("PATCH /api/users error:", e);
    return fail("Internal server error", 500);
  }
}
