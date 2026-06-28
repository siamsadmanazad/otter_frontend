import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const DENY = /AUTH_REQUIRED|FORBIDDEN|TRIP_NOT_FOUND|REQUEST_NOT_FOUND/;

// POST /api/tribe/trips/respond  body { tripId, userId, accept }
// Owner/moderator accepts or declines a join request (auth enforced in the RPC).
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const { tripId, userId, accept } = await request.json();
    if (!tripId || !userId) return fail("tripId and userId are required", 400);
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("respond_to_trip_request", {
      p_trip: tripId,
      p_user: userId,
      p_accept: accept === true,
    });
    if (error) return fail(error.message, DENY.test(error.message) ? 400 : 500);
    return ok(data, accept ? "Request accepted" : "Request declined");
  } catch (e) {
    console.error("POST /api/tribe/trips/respond error:", e);
    return fail("Failed to respond", 500);
  }
}
