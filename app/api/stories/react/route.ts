import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// docs/polish_pass_2026_09_07.md item 4 -- heart / un-heart one story segment.
//
// Unlike /api/stories/view this is NOT fire-and-forget: the viewer shows the
// heart filled optimistically and needs the server's resulting count to settle
// on, so a real failure has to surface rather than 200 with a lie.
//
// react_to_story() is itself deliberately silent about stories the caller
// cannot see -- it returns 0 rather than raising, so this endpoint cannot be
// used to probe whether a private story exists or who is in an audience group.
// See that function's own comment.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const storyId: unknown = body.storyId;
    if (typeof storyId !== "string" || !UUID_RE.test(storyId)) {
      return fail("Invalid story ID", 400);
    }
    // Absent means "heart it" -- the common case, so the client need not send
    // the flag for the gesture it makes 90% of the time.
    const on = body.on === undefined ? true : body.on === true;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("react_to_story", {
      p_story: storyId,
      p_on: on,
    });
    if (error) return fail(error.message, 400);

    return ok({ reacted: on, reactionCount: typeof data === "number" ? data : 0 }, "OK");
  } catch (e) {
    console.error("POST /api/stories/react error:", e);
    return fail("Internal server error", 500);
  }
}
