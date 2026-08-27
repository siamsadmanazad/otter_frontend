import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// Otter Trails (otter_flutter/docs/gamify_implementation.md Phase 2, spec
// gamify.md §5-§7) -- list + create recorded GPS activities.
//
// ⚠️ Every summary metric (distance, speed, elevation) is computed by
// save_activity() SERVER-SIDE from the submitted polyline. Anything the client
// sends as a total is passed through only as `clientDistance`, a fraud
// cross-check that is never displayed and never rewarded on (§54). Do not
// "helpfully" start trusting client totals here.

const ACTIVITY_TYPES = new Set([
  "WALK", "RUN", "HIKE", "TREK", "CYCLE", "BICYCLE",
  "MOTORCYCLE", "CAR_CRUISE", "ROAD_TRIP", "KAYAK", "OTHER",
]);
const VISIBILITIES = new Set(["PRIVATE", "FOLLOWERS", "PUBLIC"]);
const ELEVATION_SOURCES = new Set(["BAROMETER", "GPS", "NONE"]);

// A 6-hour ride at 1 Hz is ~21,600 fixes; the client simplifies before upload,
// so anything past this is either a bug or an attack. Rejected rather than
// truncated -- silently dropping half a route would corrupt the distance.
const MAX_POINTS = 20000;

type Pt = [number, number, number | null, number];

/**
 * Validate the polyline into fixed-position [lat, lng, ele, tOffset] tuples.
 * Returns null (not a partial list) on any malformed point -- a route with
 * holes silently punched in it produces a wrong distance, which is worse than
 * a rejected upload.
 */
function sanitizePoints(input: unknown): Pt[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > MAX_POINTS) return null;
  const out: Pt[] = [];
  for (const raw of input) {
    if (!Array.isArray(raw) || raw.length < 2) return null;
    const lat = Number(raw[0]);
    const lng = Number(raw[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const eleRaw = raw[2];
    const ele =
      eleRaw === null || eleRaw === undefined || !Number.isFinite(Number(eleRaw))
        ? null
        : Number(eleRaw);
    const t = Number.isFinite(Number(raw[3])) ? Number(raw[3]) : 0;
    out.push([lat, lng, ele, t]);
  }
  return out;
}

// GET /api/activities?limit=&before= -> my_activities()
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 30);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;
    const before = request.nextUrl.searchParams.get("before");

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("my_activities", {
      p_limit: limit,
      p_before: before || null,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Activities retrieved");
  } catch (e) {
    console.error("GET /api/activities error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/activities -> save_activity()
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));

    const activityType = String(body.activityType ?? "").toUpperCase();
    if (!ACTIVITY_TYPES.has(activityType)) return fail("Invalid activity type", 400);

    const startedAt = String(body.startedAt ?? "");
    const endedAt = String(body.endedAt ?? "");
    if (!startedAt || !endedAt) return fail("startedAt and endedAt are required", 400);
    const startMs = Date.parse(startedAt);
    const endMs = Date.parse(endedAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return fail("Invalid timestamps", 400);
    }
    if (endMs < startMs) return fail("Activity cannot end before it starts", 400);

    const points = sanitizePoints(body.points);
    if (points === null) {
      return fail(`Invalid route points (max ${MAX_POINTS})`, 400);
    }
    // A saved activity with no route is not a recording, it's a blank row. The
    // recorder discards these locally; reaching here means something is wrong.
    if (points.length < 2) return fail("An activity needs at least 2 route points", 400);

    const visibility = String(body.visibility ?? "PRIVATE").toUpperCase();
    if (!VISIBILITIES.has(visibility)) return fail("Invalid visibility", 400);

    const elevationSource = String(body.elevationSource ?? "NONE").toUpperCase();
    if (!ELEVATION_SOURCES.has(elevationSource)) return fail("Invalid elevation source", 400);

    const num = (v: unknown): number | null =>
      Number.isFinite(Number(v)) ? Number(v) : null;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("save_activity", {
      p_activity_type: activityType,
      p_started_at: new Date(startMs).toISOString(),
      p_ended_at: new Date(endMs).toISOString(),
      p_points: points,
      p_moving_seconds: num(body.movingSeconds),
      p_elevation_source: elevationSource,
      // Null lets the server derive elevation from the polyline itself. Only
      // the barometer path supplies these, because only the device can measure
      // pressure -- see decision D2.
      p_elevation_gain: elevationSource === "BAROMETER" ? num(body.elevationGainM) : null,
      p_elevation_loss: elevationSource === "BAROMETER" ? num(body.elevationLossM) : null,
      p_raw_point_count: num(body.rawPointCount),
      p_gps_accuracy_avg: num(body.gpsAccuracyAvg),
      p_client_distance: num(body.clientDistanceMeters),
      p_title: typeof body.title === "string" ? body.title.slice(0, 120) : null,
      p_note: typeof body.note === "string" ? body.note.slice(0, 2000) : null,
      p_visibility: visibility,
      p_h3_coarse: typeof body.h3Coarse === "string" ? body.h3Coarse : null,
    });
    if (error) return fail(error.message, 500);

    return ok({ id: data }, "Activity saved");
  } catch (e) {
    console.error("POST /api/activities error:", e);
    return fail("Internal server error", 500);
  }
}
