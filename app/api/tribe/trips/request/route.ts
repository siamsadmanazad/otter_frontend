import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const DENY = /AUTH_REQUIRED|OWN_TRIP|NOT_A_MEMBER|TRIP_CLOSED|TRIP_NOT_FOUND/;

// POST /api/tribe/trips/request  body { tripId, message? } -> request to join.
// Runs on the actor client so auth.uid() resolves inside request_to_join_trip.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const { tripId, message } = await request.json();
    if (!tripId) return fail("tripId is required", 400);
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("request_to_join_trip", {
      p_trip: tripId,
      p_message: message ?? null,
    });
    if (error) return fail(error.message, DENY.test(error.message) ? 400 : 500);
    return ok(data, "Requested to join");
  } catch (e) {
    console.error("POST /api/tribe/trips/request error:", e);
    return fail("Failed to send request", 500);
  }
}

// DELETE /api/tribe/trips/request?tripId=  -> cancel your own request.
export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const tripId = request.nextUrl.searchParams.get("tripId") ?? "";
    if (!tripId) return fail("tripId is required", 400);
    const db = createAdminClient();
    const { error } = await db
      .from("tribe_trip_requests")
      .delete()
      .eq("trip_id", tripId)
      .eq("user_id", user.id);
    if (error) return fail(error.message, 400);
    return ok({ tripId, status: "NONE" }, "Request cancelled");
  } catch (e) {
    console.error("DELETE /api/tribe/trips/request error:", e);
    return fail("Failed to cancel request", 500);
  }
}
