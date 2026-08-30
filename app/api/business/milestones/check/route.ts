import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/business/milestones/check
// business_identity_and_standing.md Track C — idempotent, self-healing merit
// + XP recheck for the caller's ACTING business, via
// business_check_milestones(). Safe to call repeatedly (every grant inside
// is gated by explorer_badges' own unique(user_id,badge_key)); called from
// the client after a successful offering publish and on loading the own
// business profile. Targets user.profileId directly, same convention as
// /api/business/analytics and /api/business/standing — no businessId in the
// request body.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("business_check_milestones", {
    p_business: user.profileId,
  });
  if (error) {
    const status = error.message === "FORBIDDEN" ? 403 : 400;
    return fail(error.message, status);
  }
  return ok(data, "Milestones checked");
}
