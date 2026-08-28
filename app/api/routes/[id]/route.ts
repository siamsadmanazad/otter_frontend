import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/routes/:id -> route_detail() (Otter Trails Phase 7, gamify.md §8)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("route_detail", { p_id: id });
    if (error) return fail(error.message, 500);
    if (!data) return fail("Route not found", 404);

    // Phase 9 -- fold in the (usually zero-or-one) segments derived from this
    // route, so the client can offer "View leaderboard" without a second
    // round trip. A failure here is non-fatal -- the route itself still loaded.
    const { data: segments } = await supabase.rpc("segments_for_route", { p_route_id: id });

    return ok({ ...data, segments: segments ?? [] }, "Route retrieved");
  } catch (e) {
    console.error("GET /api/routes/[id] error:", e);
    return fail("Internal server error", 500);
  }
}
