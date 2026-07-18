import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail, mapProfile } from "@/lib/api/http";
import { canViewProfile } from "@/lib/api/visibility";
import { captureRouteError } from "@/lib/observability";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/users?id=<uuid> — public profile + aggregate counts (IUserProfile shape).
// Honors privacy.profileVisibility: non-viewers get a restricted payload (identity
// + counts only, no bio/location/socials) with `restricted: true`.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = request.nextUrl.searchParams.get("id");
    if (!userId?.trim()) return fail("User ID is required", 400);
    if (!UUID_RE.test(userId)) return fail("Invalid user ID format", 400);

    const db = createAdminClient();
    const { data: profile, error } = await db
      .from("profiles")
      .select(
        "id, serial, username, full_name, profile_image, cover_image, bio, location, socials, email, active, role, reputation, preferences, created_at, updated_at"
      )
      .eq("id", userId)
      .single();

    if (error || !profile) return fail("User not found", 404);

    const viewer = await getServerUser(request);
    const allowed = await canViewProfile(db, viewer?.id ?? null, userId, profile.preferences);

    const [posts, comments, followers, following] = await Promise.all([
      db.from("posts").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      db.from("comments").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      db.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
      db.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
    ]);

    // Secondary enrichment (D14): these 4 count queries can fail independently
    // of the primary profile fetch. supabase-js resolves with `{ error }`
    // rather than rejecting, so a failure here would otherwise be silently
    // coalesced into a misleading "0" via `?? 0` below. Surface it instead.
    const countErrors = [posts.error, comments.error, followers.error, following.error].filter(Boolean);
    if (countErrors.length) {
      captureRouteError("profile counts enrichment degraded", {
        userId,
        errors: countErrors.map((e) => e!.message),
      });
    }

    const mapped = mapProfile(profile);
    const data = {
      ...mapped,
      // Hide the personal detail of a restricted profile; keep identity + counts.
      ...(allowed ? {} : { bio: "", location: "", socials: null, restricted: true }),
      // Embedded (not just the top-level envelope) because the mobile client's
      // ApiClient unwraps to `body.data` and drops sibling envelope keys.
      ...(countErrors.length ? { partial: true } : {}),
      profile: {
        id: profile.id,
        postsCount: posts.count ?? 0,
        commentsCount: comments.count ?? 0,
        followersCount: followers.count ?? 0,
        followingCount: following.count ?? 0,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    };
    return ok(data, "User data retrieved successfully", 200, countErrors.length > 0);
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
      .eq("id", user.id)
      .select(
        "id, serial, username, full_name, profile_image, cover_image, bio, location, socials, email, active, role, reputation, created_at, updated_at"
      )
      .single();

    if (error) return fail(error.message, 500);
    return ok(mapProfile(data), "Profile Updated!");
  } catch (e) {
    console.error("PATCH /api/users error:", e);
    return fail("Internal server error", 500);
  }
}
