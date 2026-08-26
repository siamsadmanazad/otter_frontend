import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set(["TOUR", "STAY", "EVENT", "CLASS", "RENTAL", "GUIDE", "TRANSPORT", "TABLE"]);
const PRICE_MODES = new Set(["FREE", "FIXED", "FROM", "ENQUIRE"]);
const BOOKING_MODES = new Set(["ENQUIRE", "RESERVE", "EXTERNAL_LINK"]);

// GET /api/offerings?ownerId=<uuid> — a business's offerings (business_mode.md
// Phase 2.1's shelf + tab). No manual status filtering needed:
// offerings_select_active_or_owner already resolves ACTIVE-for-everyone vs
// DRAFT/PAUSED-for-owner-or-staff via current_profile_id(), so an anonymous
// or unrelated viewer transparently sees only what's live.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const ownerId = request.nextUrl.searchParams.get("ownerId");
    if (!ownerId?.trim()) return fail("ownerId is required", 400);
    if (!UUID_RE.test(ownerId)) return fail("Invalid ownerId format", 400);

    const db = await createActorClient(request);
    const { data, error } = await db
      .from("offerings")
      .select(
        "id, type, status, title, description, images, niche_id, price_mode, price_cents, currency, booking_mode, external_url, always_available, starts_at, ends_at, capacity, place_id, lat, lng, created_at"
      )
      .eq("owner_profile_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) return fail(error.message, 500);

    // Phase 4.5 -- isSaved relative to the VIEWER (RLS on saved_offerings
    // already scopes this to their own rows), not the owner. Best-effort:
    // an anonymous viewer or a lookup failure just means every isSaved
    // stays false, same fail-open shape as other secondary enrichments.
    const viewer = await getServerUser(request);
    let savedIds = new Set<string>();
    if (viewer && data?.length) {
      const { data: saved } = await db
        .from("saved_offerings")
        .select("offering_id")
        .in(
          "offering_id",
          data.map((o) => o.id)
        );
      savedIds = new Set((saved ?? []).map((s) => s.offering_id));
    }

    const mapped = (data ?? []).map((o) => ({
      id: o.id,
      type: o.type,
      status: o.status,
      title: o.title,
      description: o.description,
      images: o.images ?? [],
      nicheId: o.niche_id,
      priceMode: o.price_mode,
      priceCents: o.price_cents,
      currency: o.currency,
      bookingMode: o.booking_mode,
      externalUrl: o.external_url,
      alwaysAvailable: o.always_available,
      startsAt: o.starts_at,
      endsAt: o.ends_at,
      capacity: o.capacity,
      placeId: o.place_id,
      lat: o.lat,
      lng: o.lng,
      createdAt: o.created_at,
      isSaved: savedIds.has(o.id),
    }));

    return ok(mapped, "Offerings retrieved");
  } catch (e) {
    console.error("GET /api/offerings error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/offerings — creates one offering, live immediately (business_mode.md
// Phase 3's composer). Caller must be ACTING AS the business
// (owner_profile_id = current_profile_id()) — offerings_insert_as_business and
// the offerings_business_owner_chk trigger are the actual gates; this
// validation exists only to fail fast with a clear message instead of an
// opaque constraint-violation 500 for the same checks the DB re-does anyway.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const type = body.type;
    if (typeof type !== "string" || !TYPES.has(type)) return fail("Invalid or missing type", 400);

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 1 || title.length > 120) return fail("title must be 1-120 characters", 400);

    const description = typeof body.description === "string" ? body.description.trim() : null;
    if (description && description.length > 4096) return fail("description too long", 400);

    const images = Array.isArray(body.images) ? body.images.filter((i: unknown) => typeof i === "string") : [];
    const tags = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [];
    const nicheId = typeof body.nicheId === "string" ? body.nicheId : null;
    const placeId = typeof body.placeId === "string" ? body.placeId : null;

    // Location is all-or-nothing (offerings_location_chk).
    const hasLat = typeof body.lat === "number";
    const hasLng = typeof body.lng === "number";
    const hasH3 = typeof body.h3Index === "string" && body.h3Index.length > 0;
    if (hasLat !== hasLng || hasLat !== hasH3) {
      return fail("lat, lng and h3Index must all be present or all absent", 400);
    }

    const alwaysAvailable = body.alwaysAvailable === true;
    const startsAt = typeof body.startsAt === "string" ? body.startsAt : null;
    const endsAt = typeof body.endsAt === "string" ? body.endsAt : null;
    if (alwaysAvailable && (startsAt || endsAt)) {
      return fail("An always-available offering cannot have dates", 400);
    }
    if (!alwaysAvailable && !startsAt) {
      return fail("A dated offering needs a start time (or mark it always available)", 400);
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return fail("endsAt must be after startsAt", 400);
    }

    const capacity = body.capacity === null || body.capacity === undefined ? null : Number(body.capacity);
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) {
      return fail("capacity must be 1-500", 400);
    }

    const priceMode = typeof body.priceMode === "string" ? body.priceMode : "ENQUIRE";
    if (!PRICE_MODES.has(priceMode)) return fail("Invalid priceMode", 400);
    let priceCents: number | null = null;
    let currency: string | null = null;
    if (priceMode === "FIXED" || priceMode === "FROM") {
      const cents = Number(body.priceCents);
      const cur: string = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
      if (!Number.isInteger(cents) || cents < 0) return fail("priceCents must be >= 0", 400);
      if (cur.length !== 3) return fail("currency must be a 3-letter code", 400);
      priceCents = cents;
      currency = cur;
    }

    const bookingMode = typeof body.bookingMode === "string" ? body.bookingMode : "ENQUIRE";
    if (!BOOKING_MODES.has(bookingMode)) return fail("Invalid bookingMode", 400);
    let externalUrl: string | null = null;
    if (bookingMode === "EXTERNAL_LINK") {
      const url: string = typeof body.externalUrl === "string" ? body.externalUrl.trim() : "";
      if (!/^https?:\/\//i.test(url)) return fail("externalUrl must be a valid http(s) link", 400);
      externalUrl = url;
    }

    const db = await createActorClient(request);
    const { data, error } = await db
      .from("offerings")
      .insert({
        owner_profile_id: user.profileId,
        type,
        status: "ACTIVE",
        title,
        description,
        images,
        niche_id: nicheId,
        tags,
        place_id: placeId,
        lat: hasLat ? body.lat : null,
        lng: hasLng ? body.lng : null,
        h3_index: hasH3 ? body.h3Index : null,
        h3_index_coarse: hasH3 ? body.h3IndexCoarse ?? null : null,
        always_available: alwaysAvailable,
        starts_at: startsAt,
        ends_at: endsAt,
        capacity,
        price_mode: priceMode,
        price_cents: priceCents,
        currency,
        booking_mode: bookingMode,
        external_url: externalUrl,
      })
      .select("id")
      .single();

    if (error) {
      const status = error.message === "OWNER_MUST_BE_BUSINESS" ? 403 : 400;
      return fail(error.message, status);
    }

    return ok({ id: data.id }, "Offering created");
  } catch (e) {
    console.error("POST /api/offerings error:", e);
    return fail("Internal server error", 500);
  }
}
