import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/business/subscription
// Business Mode Phase 7.2 — the caller's ACTING business's subscription state,
// via get_business_subscription(). Same "no businessId param, targets the
// caller's own acting profile" convention as /api/business/staff and
// /api/business/analytics. Never exposes stripe_customer_id/
// stripe_subscription_id — just what a future paywall UI would need
// (gateEnabled/isPro/status/currentPeriodEnd).
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("get_business_subscription", {
    p_business: user.profileId,
  });
  if (error) {
    return fail(error.message, error.message === "FORBIDDEN" ? 403 : 400);
  }

  return ok(data, "Subscription status retrieved");
}
