import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/business/place  body { title, lat, lng, h3Index, subtitle?,
// photoUrl?, nicheId?, confirmNew? } -> create_place_checked() (0.5's dedupe
// guard -- business_mode.md Phase 1.3's location step). Returns EITHER
// { created: true, placeId } or { created: false, reason: "DUPLICATE_CANDIDATES",
// duplicates: [...] } for the client's claim prompt. The caller must be
// ACTING AS the business (current_profile_id() = the business) -- the RPC
// raises BUSINESS_REQUIRED otherwise, same rule as offerings.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title : "";
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const h3Index = typeof body?.h3Index === "string" ? body.h3Index : "";
  if (!title || !Number.isFinite(lat) || !Number.isFinite(lng) || !h3Index) {
    return fail("title, lat, lng and h3Index are required", 400);
  }

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("create_place_checked", {
    p_title: title,
    p_lat: lat,
    p_lng: lng,
    p_h3_index: h3Index,
    p_subtitle: body?.subtitle ?? null,
    p_photo_url: body?.photoUrl ?? null,
    p_niche_id: body?.nicheId ?? null,
    p_confirm_new: body?.confirmNew === true,
  });
  if (error) {
    const status = error.message === "BUSINESS_REQUIRED" ? 403 : 400;
    return fail(error.message, status);
  }

  return ok(data, "Place checked");
}
