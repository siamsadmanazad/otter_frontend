import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// docs/stories.md Phase 6.5 -- exposes story_live_status() (built for 4.1's
// chat-list ring, server-side only until now) to any Flutter screen, for
// the profile hero's live-story chip. Single-author call; the chat list's
// own batched call stays server-side in the conversations route.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/stories/live-status?author=<uuid> -> story_live_status([author])
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const author = request.nextUrl.searchParams.get("author");
    if (!author || !UUID_RE.test(author)) return fail("Invalid author ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("story_live_status", { p_authors: [author] });
    if (error) return fail(error.message, 500);
    // One row (or none -- no live story) for a single-author call.
    const row = Array.isArray(data) && data.length ? data[0] : null;
    return ok(row, "Live status retrieved");
  } catch (e) {
    console.error("GET /api/stories/live-status error:", e);
    return fail("Internal server error", 500);
  }
}
