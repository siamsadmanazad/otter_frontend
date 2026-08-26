import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/business/place/claim  body { placeId } -> claim_place() (0.5's
// "claiming is the happy path" flow -- for when the setup wizard's dedupe
// check returns a candidate the host recognizes as their own).
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const placeId = typeof body?.placeId === "string" ? body.placeId : "";
  if (!placeId) return fail("placeId is required", 400);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("claim_place", { p_place: placeId });
  if (error) {
    const known: Record<string, number> = {
      BUSINESS_REQUIRED: 403,
      PLACE_ALREADY_CLAIMED: 409,
      PLACE_NOT_FOUND: 404,
    };
    return fail(error.message, known[error.message] ?? 400);
  }

  return ok(data, "Place claimed");
}
