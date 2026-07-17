import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/radar/places/save  body: { placeId }
// Toggle a private bookmark on a curated radar spot (Otter Radar Phase 6.1)
// via the toggle_saved_place RPC. Returns { isSaved }.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const placeId = typeof body?.placeId === "string" ? body.placeId : "";
    if (!UUID_RE.test(placeId)) return fail("Invalid place", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_saved_place", {
      p_place_id: placeId,
    });
    if (error) {
      if (/PLACE_NOT_FOUND/i.test(error.message || "")) {
        return fail("Place not found", 404);
      }
      return fail(error.message, 500);
    }
    return ok(data, "Saved");
  } catch (e) {
    console.error("POST /api/radar/places/save error:", e);
    return fail("Failed saving place", 500);
  }
}

// GET /api/radar/places/save — the caller's saved spots, via get_saved_places.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_saved_places");
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Saved places");
  } catch (e) {
    console.error("GET /api/radar/places/save error:", e);
    return fail("Failed loading saved places", 500);
  }
}
