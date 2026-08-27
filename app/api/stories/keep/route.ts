import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// docs/stories.md Phase 5.1 -- the "keep this?" moment (5.2)'s write path.
// keep_story() itself shipped in Phase 0 and has never had a caller until
// now: it's SECURITY DEFINER and re-checks ownership internally (dual-arm,
// G6), so this route is a thin pass-through on the actor client, same shape
// as every other stories RPC route.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/stories/keep  body { storyId } -> keep_story()
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json().catch(() => ({}));
    const storyId: string | undefined = body.storyId;
    if (!storyId || !UUID_RE.test(storyId)) return fail("Invalid story ID", 400);

    const supabase = await createActorClient(request);
    const { error } = await supabase.rpc("keep_story", { p_story: storyId });
    if (error) {
      if (error.message.includes("STORY_NOT_FOUND")) return fail("Story not found", 404);
      if (error.message.includes("FORBIDDEN")) return fail("You can't keep that story", 403);
      return fail(error.message, 500);
    }
    return ok(null, "Saved");
  } catch (e) {
    console.error("POST /api/stories/keep error:", e);
    return fail("Internal server error", 500);
  }
}
