import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// Otter Trails Phase 9 (gamify.md §9) -- create a segment from a route you
// own. Segments are never available for MOTORCYCLE/CAR_CRUISE/ROAD_TRIP
// (§12/§67) -- enforced server-side by a CHECK constraint, this route just
// surfaces whatever create_segment() raises.

// POST /api/segments  body { routeId, name? } -> create_segment()
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const routeId = String(body.routeId ?? "");
    if (!routeId) return fail("routeId is required", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("create_segment", {
      p_route_id: routeId,
      p_name: typeof body.name === "string" ? body.name.slice(0, 120) : null,
    });
    if (error) {
      if (/ROUTE_NOT_FOUND/i.test(error.message || "")) return fail("Route not found", 404);
      return fail(error.message, 400);
    }

    return ok({ id: data }, "Segment created");
  } catch (e) {
    console.error("POST /api/segments error:", e);
    return fail("Internal server error", 500);
  }
}
