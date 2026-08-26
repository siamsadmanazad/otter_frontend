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
        "id, serial, username, full_name, profile_image, cover_image, bio, location, socials, email, active, role, reputation, preferences, kind, created_at, updated_at"
      )
      .eq("id", userId)
      .single();

    if (error || !profile) return fail("User not found", 404);

    const viewer = await getServerUser(request);
    const allowed = await canViewProfile(db, viewer?.id ?? null, userId, profile.preferences);

    const isBusiness = profile.kind === "BUSINESS";
    const [posts, comments, followers, following, businessRow, placeRow] = await Promise.all([
      db.from("posts").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      db.from("comments").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      db.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
      db.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
      isBusiness
        ? db
            .from("business_profiles")
            .select(
              "legal_name, contact_email, contact_phone, website, hours, price_band, service_area, verification, niche:niches(id, slug, display_name, color_hex, icon_key)"
            )
            .eq("profile_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      isBusiness
        ? db
            .from("radar_places")
            .select("id, title, subtitle, lat, lng")
            .eq("owner_profile_id", userId)
            .eq("claim_status", "CLAIMED")
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
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
    const business = businessRow.data as Record<string, unknown> | null;
    const place = placeRow.data as Record<string, unknown> | null;
    const niche = business?.niche as Record<string, unknown> | null | undefined;
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
      // Business Mode Phase 2.1 — only present for kind=BUSINESS profiles.
      // Absent (not an empty object) when there's nothing to show, so the
      // client can gate module rendering on `data.business != null`.
      ...(isBusiness && business
        ? {
            business: {
              legalName: business.legal_name,
              contactEmail: business.contact_email,
              contactPhone: business.contact_phone,
              website: business.website,
              hours: business.hours,
              priceBand: business.price_band,
              serviceArea: business.service_area,
              verification: business.verification,
              niche: niche
                ? {
                    id: niche.id,
                    slug: niche.slug,
                    displayName: niche.display_name,
                    colorHex: niche.color_hex,
                    iconKey: niche.icon_key,
                  }
                : null,
              place: place
                ? {
                    id: place.id,
                    title: place.title,
                    subtitle: place.subtitle,
                    lat: place.lat,
                    lng: place.lng,
                  }
                : null,
            },
          }
        : {}),
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
