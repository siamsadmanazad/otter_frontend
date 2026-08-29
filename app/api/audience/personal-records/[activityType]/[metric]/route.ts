import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// PATCH /api/audience/personal-records/:activityType/:metric -> set_personal_record_audience()
//
// "Who can see this personal best" (docs/audiences.md), same picker UI and
// same MODES set as /api/audience/badges/[badgeId]. personal_records has no
// single-column id -- its primary key is the composite (user_id,
// activity_type, metric), one row per metric per activity type -- so this
// route addresses a record by that pair instead of an id.

const MODES = new Set(["EVERYONE", "FOLLOWERS", "GROUP", "ONLY_ME"]);
const ACTIVITY_TYPES = new Set([
  "WALK", "RUN", "HIKE", "TREK", "CYCLE", "BICYCLE",
  "MOTORCYCLE", "CAR_CRUISE", "ROAD_TRIP", "KAYAK", "OTHER",
]);
const METRICS = new Set(["DISTANCE", "DURATION", "ELEVATION", "PACE"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ activityType: string; metric: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { activityType, metric } = await ctx.params;
    const type = activityType.toUpperCase();
    const met = metric.toUpperCase();
    if (!ACTIVITY_TYPES.has(type)) return fail("Invalid activity type", 400);
    if (!METRICS.has(met)) return fail("Invalid metric", 400);

    const body = await request.json();
    const mode: string = body.mode;
    if (!MODES.has(mode)) return fail("Invalid audience mode", 400);
    const groupId: string | null = body.groupId || null;
    if (mode === "GROUP" && (!groupId || !UUID_RE.test(groupId))) {
      return fail("A group is required for GROUP mode", 400);
    }

    const supabase = await createActorClient(request);
    const { error } = await supabase.rpc("set_personal_record_audience", {
      p_activity_type: type,
      p_metric: met,
      p_mode: mode,
      p_group_id: mode === "GROUP" ? groupId : null,
    });
    if (error) {
      if (error.message.includes("NOT_FOUND")) return fail("Personal record not found", 404);
      if (error.message.includes("INVALID_AUDIENCE_GROUP")) return fail("Invalid group", 400);
      return fail(error.message, 500);
    }
    return ok(
      { activityType: type, metric: met, mode, groupId: mode === "GROUP" ? groupId : null },
      "Audience updated"
    );
  } catch (e) {
    console.error("PATCH /api/audience/personal-records/[activityType]/[metric] error:", e);
    return fail("Internal server error", 500);
  }
}
