import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// PATCH /api/business/profile  body { nicheId? } -> updates the CALLER's own
// business_profiles row (business_mode.md Phase 1.3's niche step; hours/
// contact/price_band land later via Phase 2's completeness meter).
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
  if (Object.keys(patch).length === 0) return fail("Nothing to update", 400);

  const db = await createActorClient(request);
  const { error } = await db
    .from("business_profiles")
    .update(patch)
    .eq("profile_id", user.profileId);
  if (error) return fail(error.message, 400);

  return ok(null, "Business profile updated");
}
