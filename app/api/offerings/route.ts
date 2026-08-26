import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    }));

    return ok(mapped, "Offerings retrieved");
  } catch (e) {
    console.error("GET /api/offerings error:", e);
    return fail("Internal server error", 500);
  }
}
