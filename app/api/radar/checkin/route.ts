import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const H3_RE = /^[0-9a-f]{15,16}$/;

// POST /api/radar/checkin  body: { placeId, h3Index, dwellSeconds? }
// Otter Trails Phase 8a (gamify.md §26) via check_in(). Returns
// {id, placeId, xpAwarded, badgesAwarded, questsCompleted}.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const placeId = typeof body?.placeId === "string" ? body.placeId : "";
    const h3Index = typeof body?.h3Index === "string" ? body.h3Index : "";
    if (!UUID_RE.test(placeId)) return fail("Invalid place", 400);
    if (!H3_RE.test(h3Index)) return fail("Invalid location", 400);
    const dwellSeconds = Number.isFinite(Number(body?.dwellSeconds))
      ? Math.max(0, Number(body.dwellSeconds))
      : 0;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("check_in", {
      p_place_id: placeId,
      p_h3_index: h3Index,
      p_dwell_seconds: dwellSeconds,
    });
    if (error) {
      if (/PLACE_NOT_FOUND/i.test(error.message || "")) return fail("Place not found", 404);
      if (/need to be at|already checked in/i.test(error.message || "")) {
        return fail(error.message, 400);
      }
      return fail(error.message, 500);
    }
    return ok(data, "Checked in");
  } catch (e) {
    console.error("POST /api/radar/checkin error:", e);
    return fail("Failed to check in", 500);
  }
}

// GET /api/radar/checkin — the caller's recent check-in history.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("my_recent_checkins", { p_limit: 20 });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Check-in history");
  } catch (e) {
    console.error("GET /api/radar/checkin error:", e);
    return fail("Failed loading check-ins", 500);
  }
}
