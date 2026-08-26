import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/business/create  body { username, fullName, nicheId?, legalName? }
// -> creates a BUSINESS profile + its extension row + a FOUNDER membership
// for the caller, atomically (business_mode.md Phase 1.2 -- "an explorer can
// add business mode later"). The richer setup wizard (niche/photo/location
// pin, Phase 1.3) collects more; this route's job is only to bring the
// profile into existence so the caller has something to switch to.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const nicheId = typeof body?.nicheId === "string" ? body.nicheId : null;
  const legalName = typeof body?.legalName === "string" ? body.legalName.trim() : null;

  if (!username) return fail("username is required", 400);
  if (!fullName) return fail("fullName is required", 400);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("create_business_profile", {
    p_username: username,
    p_full_name: fullName,
    p_niche_id: nicheId,
    p_legal_name: legalName,
  });
  if (error) {
    const known = ["EXPLORER_REQUIRED", "INVALID_USERNAME", "INVALID_NAME", "USERNAME_TAKEN"];
    const status = known.includes(error.message) ? 400 : 500;
    return fail(error.message, status);
  }

  return ok({ profileId: data }, "Business profile created");
}
