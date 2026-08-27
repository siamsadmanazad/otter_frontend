import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// docs/stories.md Phase 2.5 -- fire-and-forget seen-state. mark_story_viewed()
// itself never raises (silently no-ops for content the caller cannot see, per
// its own comment, so it can't be used as an existence/audience oracle) --
// this route mirrors that: a DB error still 200s, since a failed seen-write
// must never surface as an error the viewer has to handle mid-playback.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json();
    const storyId: string | undefined = body.storyId;
    if (!storyId || !UUID_RE.test(storyId)) return fail("Invalid story ID", 400);

    const supabase = await createActorClient(request);
    const { error } = await supabase.rpc("mark_story_viewed", { p_story: storyId });
    if (error) console.error("mark_story_viewed error:", error.message);
    return ok(null, "OK");
  } catch (e) {
    console.error("POST /api/stories/view error:", e);
    return ok(null, "OK");
  }
}
