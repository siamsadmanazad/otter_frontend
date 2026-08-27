import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// docs/stories.md Phase 6.1 -- a place's live tagged stories, for the
// RadarNodeSheet strip. Deliberately its own route/RPC, not a filter on the
// tray or segments endpoints -- see place_live_stories()'s own migration
// comment.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/stories/place?placeId=<uuid> -> place_live_stories()
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const placeId = request.nextUrl.searchParams.get("placeId");
    if (!placeId || !UUID_RE.test(placeId)) return fail("Invalid place ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("place_live_stories", { p_place: placeId });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Place stories retrieved");
  } catch (e) {
    console.error("GET /api/stories/place error:", e);
    return fail("Internal server error", 500);
  }
}
