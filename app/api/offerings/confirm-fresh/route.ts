import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/offerings/confirm-fresh  body { offeringId }
// Business Mode Phase 0.4's "freshness ping" (G4) — bumps last_confirmed_at
// via confirm_offering_fresh() so an always-available offering keeps passing
// is_offering_live() past FRESHNESS_DAYS. Owner or staff only (the RPC's own
// dual-arm check). Found during the 8.1 copy pass: 0.4 shipped this RPC with
// zero client call sites — an always-available offering had no way to avoid
// silently going stale. This route + the Flutter "Confirm" action close that.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const offeringId = typeof body?.offeringId === "string" ? body.offeringId : "";
    if (!UUID_RE.test(offeringId)) return fail("Invalid offering", 400);

    const db = await createActorClient(request);
    const { error } = await db.rpc("confirm_offering_fresh", {
      p_offering: offeringId,
    });
    if (error) {
      const status =
        error.message === "FORBIDDEN" ? 403 : error.message === "OFFERING_NOT_FOUND" ? 404 : 400;
      return fail(error.message, status);
    }
    return ok(null, "Confirmed");
  } catch (e) {
    console.error("POST /api/offerings/confirm-fresh error:", e);
    return fail("Internal server error", 500);
  }
}
