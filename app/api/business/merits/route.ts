import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/business/merits?businessId=<uuid>
// business_identity_and_standing.md Track C — a business's public "biz_"
// merits, via business_merits(). Deliberately no auth gate (mirrors
// is_offering_live()'s own `grant ... to anon` posture) — merits are public
// trust signals meant to be visible on a business profile whether or not the
// viewer is signed in, same spirit as GET /api/offerings?ownerId=.
export async function GET(request: NextRequest): Promise<Response> {
  const businessId = request.nextUrl.searchParams.get("businessId");
  if (!businessId?.trim()) return fail("businessId is required", 400);
  if (!UUID_RE.test(businessId)) return fail("Invalid businessId format", 400);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("business_merits", { p_business: businessId });
  if (error) return fail(error.message, 500);
  return ok(data ?? [], "Merits retrieved");
}
