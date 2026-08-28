import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// Otter Trails Phase 7 (gamify.md §8) -- browse + publish routes.
//
// A route is a PUBLIC snapshot of one of the caller's own completed
// activities, privacy-zone-trimmed once at creation (routes_nearby/
// route_detail never do their own trimming -- the stored geometry is already
// safe to hand to anyone).

const ACTIVITY_TYPES = new Set([
  "WALK", "RUN", "HIKE", "TREK", "CYCLE", "BICYCLE",
  "MOTORCYCLE", "CAR_CRUISE", "ROAD_TRIP", "KAYAK", "OTHER",
]);
const DIFFICULTIES = new Set(["EASY", "MODERATE", "HARD"]);

// GET /api/routes?cells=a,b,c&activityType=&limit= -> routes_nearby()
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const cellsRaw = request.nextUrl.searchParams.get("cells");
    const cells = cellsRaw ? cellsRaw.split(",").map((c) => c.trim()).filter(Boolean) : null;
    const activityType = request.nextUrl.searchParams.get("activityType");
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 30);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("routes_nearby", {
      p_cells: cells,
      p_activity_type: activityType && ACTIVITY_TYPES.has(activityType) ? activityType : null,
      p_limit: limit,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Routes retrieved");
  } catch (e) {
    console.error("GET /api/routes error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/routes  body { activityId, name, description?, difficulty? } -> save_route()
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));

    const activityId = String(body.activityId ?? "");
    if (!activityId) return fail("activityId is required", 400);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail("A route needs a name", 400);

    const difficulty = String(body.difficulty ?? "MODERATE").toUpperCase();
    if (!DIFFICULTIES.has(difficulty)) return fail("Invalid difficulty", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("save_route", {
      p_activity_id: activityId,
      p_name: name.slice(0, 120),
      p_description: typeof body.description === "string" ? body.description.slice(0, 2000) : null,
      p_difficulty: difficulty,
    });
    if (error) return fail(error.message, 400);

    return ok({ id: data }, "Route published");
  } catch (e) {
    console.error("POST /api/routes error:", e);
    return fail("Internal server error", 500);
  }
}
