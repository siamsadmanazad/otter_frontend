import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail, mapPublicUser } from "@/lib/api/http";

type DB = ReturnType<typeof createAdminClient>;

const TRIP_COLS =
  "id, tribe_id, owner_id, title, destination, trip_start, trip_end, spots, budget, travel_style, notes, status, accepted_count, created_at, updated_at, owner:profiles!tribe_trips_owner_id_fkey(id, username, full_name, profile_image)";

function mapTrip(t: Record<string, any>, myStatus?: string) {
  return {
    id: t.id,
    tribeId: t.tribe_id,
    title: t.title,
    destination: t.destination,
    tripStart: t.trip_start,
    tripEnd: t.trip_end,
    spots: t.spots,
    acceptedCount: t.accepted_count ?? 0,
    budget: t.budget,
    travelStyle: t.travel_style,
    notes: t.notes,
    status: t.status,
    createdAt: t.created_at,
    owner: mapPublicUser(t.owner),
    myRequestStatus: myStatus ?? "NONE",
  };
}

function range(page: string, limit: string) {
  const p = Math.max(1, parseInt(page || "1", 10));
  const l = Math.max(1, parseInt(limit || "20", 10));
  return { from: (p - 1) * l, to: (p - 1) * l + l - 1 };
}

async function isModerator(db: DB, tribeId: string, uid: string) {
  const { data } = await db.rpc("can_moderate_tribe", { p_tribe_id: tribeId, p_uid: uid });
  return data === true;
}

// List trips in a tribe, annotated with the caller's request status per trip.
async function listTrips(db: DB, tribeId: string, uid: string, page: string, limit: string) {
  const { from, to } = range(page, limit);
  const { data, error } = await db
    .from("tribe_trips")
    .select(TRIP_COLS)
    .eq("tribe_id", tribeId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  const trips = (data ?? []) as Record<string, any>[];

  // One round-trip for the caller's own requests across these trips.
  const ids = trips.map((t) => t.id);
  const mine = new Map<string, string>();
  if (ids.length) {
    const { data: reqs } = await db
      .from("tribe_trip_requests")
      .select("trip_id, status")
      .eq("user_id", uid)
      .in("trip_id", ids);
    for (const r of (reqs ?? []) as { trip_id: string; status: string }[]) {
      mine.set(r.trip_id, r.status);
    }
  }
  return trips.map((t) => mapTrip(t, t.owner_id === uid ? "OWNER" : mine.get(t.id)));
}

// List the requests for one trip (owner / moderator only).
async function listRequests(db: DB, tripId: string, uid: string, page: string, limit: string) {
  const { data: trip } = await db
    .from("tribe_trips")
    .select("owner_id, tribe_id")
    .eq("id", tripId)
    .single();
  if (!trip) return null;
  const allowed = trip.owner_id === uid || (await isModerator(db, trip.tribe_id, uid));
  if (!allowed) return "forbidden";

  const { from, to } = range(page, limit);
  const { data } = await db
    .from("tribe_trip_requests")
    .select(
      "status, message, created_at, u:profiles!tribe_trip_requests_user_id_fkey(id, username, full_name, profile_image)"
    )
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })
    .range(from, to);
  return ((data ?? []) as any[]).map((r) => ({
    user: mapPublicUser(r.u),
    status: r.status,
    message: r.message,
    createdAt: r.created_at,
  }));
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const sp = request.nextUrl.searchParams;
  const tribeId = sp.get("tribeId") ?? "";
  const tripId = sp.get("tripId") ?? "";
  const requests = sp.get("requests") === "true";
  const page = sp.get("page") ?? "";
  const limit = sp.get("limit") ?? "";
  try {
    const db = createAdminClient();
    if (tripId && requests) {
      const res = await listRequests(db, tripId, user.id, page, limit);
      if (res === null) return fail("Trip not found", 404);
      if (res === "forbidden") return fail("Not allowed", 403);
      return ok(res, "Trip requests");
    }
    if (tribeId) return ok(await listTrips(db, tribeId, user.id, page, limit), "Trips");
    return fail("tribeId or tripId is required", 400);
  } catch (e) {
    console.error("GET /api/tribe/trips error:", e);
    return fail("Internal server error", 500);
  }
}

// Create a trip (must be a member of the tribe; owner is the caller).
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const b = await request.json();
    const tribeId: string = b.tribeId ?? "";
    if (!tribeId) return fail("tribeId is required", 400);
    if (!b.title?.trim() || b.title.trim().length < 2) return fail("A title is required", 400);

    const db = createAdminClient();
    const { count } = await db
      .from("tribe_members")
      .select("user_id", { count: "exact", head: true })
      .eq("tribe_id", tribeId)
      .eq("user_id", user.id);
    if (!count) return fail("Join the tribe to post a trip", 403);

    const spots = Math.min(50, Math.max(1, parseInt(`${b.spots ?? 1}`, 10) || 1));
    const { data, error } = await db
      .from("tribe_trips")
      .insert({
        tribe_id: tribeId,
        owner_id: user.id,
        title: b.title.trim(),
        destination: b.destination ?? null,
        trip_start: b.tripStart ?? null,
        trip_end: b.tripEnd ?? null,
        spots,
        budget: b.budget ?? "MID",
        travel_style: b.travelStyle ?? "MIXED",
        notes: b.notes ?? null,
      })
      .select(TRIP_COLS)
      .single();
    if (error) return fail(error.message, 400);
    return ok(mapTrip(data, "OWNER"), "Trip created");
  } catch (e) {
    console.error("POST /api/tribe/trips error:", e);
    return fail("Failed to create trip", 500);
  }
}

// Delete a trip (owner or tribe moderator).
export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const tripId = request.nextUrl.searchParams.get("tripId") ?? "";
    if (!tripId) return fail("tripId is required", 400);
    const db = createAdminClient();
    const { data: trip } = await db
      .from("tribe_trips")
      .select("owner_id, tribe_id")
      .eq("id", tripId)
      .single();
    if (!trip) return fail("Trip not found", 404);
    const allowed = trip.owner_id === user.id || (await isModerator(db, trip.tribe_id, user.id));
    if (!allowed) return fail("Not allowed", 403);

    const { error } = await db.from("tribe_trips").delete().eq("id", tripId);
    if (error) return fail(error.message, 400);
    return ok({ id: tripId }, "Trip deleted");
  } catch (e) {
    console.error("DELETE /api/tribe/trips error:", e);
    return fail("Failed to delete trip", 500);
  }
}
