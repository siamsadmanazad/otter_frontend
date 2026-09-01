import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/offerings/reactivate  body { offeringId }
// Lifts a report-triggered auto-suspension (business_mode.md Phase 5.2) via
// reactivate_offering() -- owner or staff only (RLS/the RPC's own dual-arm
// check), fails cleanly if the offering was never auto-suspended. Moves the
// triggering reports to REVIEWING server-side; nothing extra to do here.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const offeringId = typeof body?.offeringId === "string" ? body.offeringId : "";
    if (!UUID_RE.test(offeringId)) return fail("Invalid service", 400);

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("reactivate_offering", {
      p_offering_id: offeringId,
    });
    if (error) {
      const status =
        error.message === "FORBIDDEN" ? 403 : error.message === "OFFERING_NOT_FOUND" ? 404 : 400;
      return fail(error.message, status);
    }
    return ok(data, "Reactivated");
  } catch (e) {
    console.error("POST /api/offerings/reactivate error:", e);
    return fail("Internal server error", 500);
  }
}
