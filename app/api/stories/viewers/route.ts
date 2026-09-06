import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/stories/viewers?storyId=<uuid> -- who watched, and who hearted.
//
// docs/polish_pass_2026_09_07.md item 4. Both RPCs behind this shipped long
// ago (story_viewers() in 20260827240000) and NO route ever called them, so the
// "seen by" list an author is entitled to has never been reachable from the app.
//
// Authorization is entirely the functions' own: each raises FORBIDDEN unless
// the caller is the story's author or that business's staff. This route does
// not re-derive that rule -- one gate, in the layer that cannot be bypassed.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  viewer_id: string;
  username: string | null;
  full_name: string | null;
  profile_image: string | null;
  viewed_at?: string;
  reacted_at?: string;
};

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const storyId = request.nextUrl.searchParams.get("storyId");
    if (!storyId || !UUID_RE.test(storyId)) return fail("Invalid story ID", 400);

    const db = await createActorClient(request);

    // One round trip each, in parallel: the sheet shows both lists at once and
    // serialising them would double its open time for no reason.
    const [viewers, reactors] = await Promise.all([
      db.rpc("story_viewers", { p_story: storyId }),
      db.rpc("story_reaction_viewers", { p_story: storyId }),
    ]);

    if (viewers.error) {
      // The functions signal their own refusals through Postgres error codes;
      // translate rather than leaking a raw SQLSTATE to the client.
      const message = viewers.error.message ?? "";
      if (message.includes("FORBIDDEN")) return fail("Not your story", 403);
      if (message.includes("STORY_NOT_FOUND")) return fail("Story not found", 404);
      return fail(message || "Could not load viewers", 400);
    }

    // The hearts half degrades on its own rather than taking the sheet down
    // with it. story_viewers() has existed since stories shipped;
    // story_reaction_viewers() arrives in 20260907120000, so between deploying
    // this route and applying that migration the function simply is not there
    // (PostgREST answers PGRST202). "Who watched" is still the answer to the
    // author's actual question, so it is served, and the heart markers just
    // stay off until the migration lands.
    if (reactors.error) {
      console.warn("story_reaction_viewers unavailable:", reactors.error.message);
    }
    const hearted = new Set((reactors.data ?? []).map((r: Row) => r.viewer_id));

    return ok(
      {
        viewers: (viewers.data ?? []).map((v: Row) => ({
          id: v.viewer_id,
          username: v.username,
          fullName: v.full_name,
          profileImage: v.profile_image,
          viewedAt: v.viewed_at ?? null,
          // Folded into the viewer rows rather than shipped as a second list:
          // "who watched, and which of them hearted it" is one list with a
          // marker, and two lists would show most people twice.
          reacted: hearted.has(v.viewer_id),
        })),
        viewerCount: (viewers.data ?? []).length,
        reactionCount: reactors.error ? 0 : (reactors.data ?? []).length,
      },
      "Viewers retrieved"
    );
  } catch (e) {
    console.error("GET /api/stories/viewers error:", e);
    return fail("Internal server error", 500);
  }
}
