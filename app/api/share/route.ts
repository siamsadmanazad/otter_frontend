import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/share  body { post } -> record one share -> { shareCount }
// Not a toggle (unlike /api/repost, /api/intent) — sharing has no undo, each
// call is a distinct share event. Called once per completed share action
// (copy link, OS share sheet, send to a DM), not merely opening the sheet.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("share", user.id, request, 30, 60);
    if (limited) return limited;

    const body = await request.json();
    const postId: string | undefined = body.post ?? body.postId;
    if (!postId?.trim()) return fail("Post ID is required", 400);
    if (!UUID_RE.test(postId)) return fail("Invalid post ID format", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("record_share", {
      p_post_id: postId,
    });
    if (error) {
      if (error.message.includes("POST_NOT_FOUND")) return fail("Post not found", 404);
      return fail(error.message, 500);
    }
    return ok(data, "Share recorded");
  } catch (e) {
    console.error("POST /api/share error:", e);
    return fail("Internal server error", 500);
  }
}
