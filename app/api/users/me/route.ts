import { NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { buildProfilePayload } from "@/lib/api/profile-payload";

// GET /api/users/me — "my own profile," resolved server-side off the JWT's
// acting_profile claim (getServerUser().profileId), NOT a client-supplied id.
// The client's own auth uid is always the human, never a business it has
// switched to act as, so GET /api/users?id=<my raw uid> silently always
// returns the EXPLORER row -- this is the fix for that (found while building
// business_mode.md 2.3; see the comment on GET /api/users for the full story).
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const result = await buildProfilePayload(user.profileId, request);
    if (!result) return fail("Profile not found", 404);
    return ok(result.body, "User data retrieved successfully", result.status, result.partial);
  } catch (e) {
    console.error("GET /api/users/me error:", e);
    return fail("Internal server error", 500);
  }
}
