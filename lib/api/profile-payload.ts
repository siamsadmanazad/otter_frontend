import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { mapProfile } from "@/lib/api/http";
import { canViewProfile } from "@/lib/api/visibility";
import { captureRouteError } from "@/lib/observability";

/**
 * Shared by GET /api/users?id= and GET /api/users/me — the same profile
 * lookup (identity + counts + the Business Mode Phase 2.1 `business` block),
 * just addressed differently. Extracted so /me can't drift from the by-id
 * shape a second time the way the two routes' PATCH allow-lists once did
 * (business-mode-plan.md's "any new namespace must be added everywhere" scar).
 */
export async function buildProfilePayload(
  userId: string,
  request: Request
): Promise<{ status: number; body: unknown; partial: boolean } | null> {
  const db = createAdminClient();
  const { data: profile, error } = await db
    .from("profiles")
    .select(
      "id, serial, username, full_name, profile_image, cover_image, bio, location, socials, email, active, role, reputation, preferences, kind, created_at, updated_at"
    )
    .eq("id", userId)
    .single();

  if (error || !profile) return null;

  const viewer = await getServerUser(request);
  // Self-check must also match on profileId: viewer.id is always the human,
  // and userId here can be a BUSINESS profile that human is acting as (never
  // equal to their own id) -- canViewProfile's own self-check would otherwise
  // miss "this is my own business profile" and fall through to the PUBLIC/
  // FOLLOWERS/PRIVATE logic for what should always just be an unconditional
  // yes.
  const viewerIdForSelfCheck =
    viewer && (viewer.profileId === userId || viewer.id === userId) ? userId : (viewer?.id ?? null);
  const allowed = await canViewProfile(db, viewerIdForSelfCheck, userId, profile.preferences);

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
    // Business Mode Phase 6.3 (multi-location) -- ALL claimed places, not
    // just one. A business claiming a second/third place was already
    // possible (0.5 never capped it -- "capping claims per business" was
    // explicitly logged as a future paid-tier lever, not a limit today);
    // this is the first place that actually LISTS them. Ordered oldest-
    // first so `places[0]` is a stable "primary" for existing UI that
    // still only wants one (the composer's default map center, the
    // completeness meter).
    isBusiness
      ? db
          .from("radar_places")
          .select("id, title, subtitle, lat, lng")
          .eq("owner_profile_id", userId)
          .eq("claim_status", "CLAIMED")
          .order("claimed_at", { ascending: true })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const countErrors = [posts.error, comments.error, followers.error, following.error].filter(Boolean);
  if (countErrors.length) {
    captureRouteError("profile counts enrichment degraded", {
      userId,
      errors: countErrors.map((e) => e!.message),
    });
  }

  const mapped = mapProfile(profile);
  const business = businessRow.data as Record<string, unknown> | null;
  const places = (placeRow.data ?? []) as Record<string, unknown>[];
  const place = places[0] ?? null;
  const niche = business?.niche as Record<string, unknown> | null | undefined;
  const mapPlace = (p: Record<string, unknown>) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    lat: p.lat,
    lng: p.lng,
  });
  const body = {
    ...mapped,
    ...(allowed ? {} : { bio: "", location: "", socials: null, restricted: true }),
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
            place: place ? mapPlace(place) : null,
            // Phase 6.3 -- every claimed place, `places[0]` === `place`
            // above (kept for the existing single-place UI). Always an
            // array (possibly empty), never absent, so the client can
            // check `places.length > 1` without a null check first.
            places: places.map(mapPlace),
          },
        }
      : {}),
  };

  return { status: 200, body, partial: countErrors.length > 0 };
}
