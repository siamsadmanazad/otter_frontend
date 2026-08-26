import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const SERVICE_AREAS = new Set(["FIXED", "ITINERANT"]);

// PATCH /api/business/profile  body { nicheId?, legalName?, contactEmail?,
// contactPhone?, website?, hours?, priceBand?, serviceArea? } -> updates the
// CALLER's own business_profiles row. Started life as Phase 1.3's niche-only
// step; Phase 2.3 (business settings section) extends it to the rest of
// business_profiles's editable columns.
//
// Targets user.profileId directly rather than accepting a businessId in the
// body -- the caller must be ACTING AS the business (or an unswitched ADMIN/
// FOUNDER via business_profiles_can_edit) for the RLS UPDATE to match at all,
// so there is no ambiguity about which business this writes to.
export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (typeof body?.nicheId === "string") patch.niche_id = body.nicheId;
  if (typeof body?.legalName === "string") patch.legal_name = body.legalName.trim() || null;
  if (typeof body?.contactEmail === "string") patch.contact_email = body.contactEmail.trim() || null;
  if (typeof body?.contactPhone === "string") patch.contact_phone = body.contactPhone.trim() || null;
  if (typeof body?.website === "string") patch.website = body.website.trim() || null;
  if (body?.hours && typeof body.hours === "object") patch.hours = body.hours;
  if (body?.priceBand !== undefined) {
    const band = body.priceBand === null ? null : Number(body.priceBand);
    if (band !== null && (!Number.isInteger(band) || band < 1 || band > 4)) {
      return fail("priceBand must be 1-4 or null", 400);
    }
    patch.price_band = band;
  }
  if (typeof body?.serviceArea === "string") {
    if (!SERVICE_AREAS.has(body.serviceArea)) return fail("Invalid serviceArea", 400);
    patch.service_area = body.serviceArea;
  }
  if (Object.keys(patch).length === 0) return fail("Nothing to update", 400);

  const db = await createActorClient(request);
  const { error } = await db
    .from("business_profiles")
    .update(patch)
    .eq("profile_id", user.profileId);
  if (error) return fail(error.message, 400);

  return ok(null, "Business profile updated");
}
