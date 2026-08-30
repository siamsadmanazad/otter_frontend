import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/business/signals?businessId=<uuid>
// business_identity_and_standing.md Track C — a business's rolling 30-day
// public Signals (activeThisWeek, savedThisMonth), via business_signals().
// No auth gate, same posture as /api/business/merits — these are public
// trust chips, always recomputed fresh (no "expired" state to hide behind
// an auth check).
export async function GET(request: NextRequest): Promise<Response> {
  const businessId = request.nextUrl.searchParams.get("businessId");
  if (!businessId?.trim()) return fail("businessId is required", 400);
  if (!UUID_RE.test(businessId)) return fail("Invalid businessId format", 400);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("business_signals", { p_business: businessId });
  if (error) return fail(error.message, 500);
  return ok(data, "Signals retrieved");
}
