import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// docs/stories.md Phase 6.4 -- a tribe's live tagged stories, for the
// community screen's strip. Same shape/discipline as /api/stories/place.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/stories/tribe?tribeId=<uuid> -> tribe_live_stories()
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const tribeId = request.nextUrl.searchParams.get("tribeId");
    if (!tribeId || !UUID_RE.test(tribeId)) return fail("Invalid tribe ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("tribe_live_stories", { p_tribe: tribeId });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Tribe stories retrieved");
  } catch (e) {
    console.error("GET /api/stories/tribe error:", e);
    return fail("Internal server error", 500);
  }
}
