import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ["WOULD_GO", "BEEN_THERE"] as const;
type IntentKind = (typeof KINDS)[number];
const isKind = (v: unknown): v is IntentKind => KINDS.includes(v as IntentKind);

// GET /api/intent?post=<uuid>&kind=WOULD_GO|BEEN_THERE&page=&limit=
// -> the people holding that intent on that post, newest first. Public
// (intents are visible acts, not bookmarks) — mirrors /api/repost's GET.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const postId = sp.get("post");
    if (!postId?.trim()) return fail("post is required", 400);
    if (!UUID_RE.test(postId)) return fail("Invalid post ID format", 400);

    const kind = sp.get("kind");
    if (!isKind(kind)) return fail("kind must be WOULD_GO or BEEN_THERE", 400);

    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_post_intent_people", {
      p_post_id: postId,
      p_kind: kind,
      p_page: page,
      p_limit: limit,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Intent people retrieved successfully");
  } catch (e) {
    console.error("GET /api/intent error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/intent  body { post, kind } -> toggle -> { isActive, count }
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("intent", user.id, request, 30, 60);
    if (limited) return limited;

    const body = await request.json();
    const postId: string | undefined = body.post ?? body.postId;
    if (!postId?.trim()) return fail("Post ID is required", 400);
    if (!isKind(body.kind)) return fail("kind must be WOULD_GO or BEEN_THERE", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_intent", {
      p_post_id: postId,
      p_kind: body.kind,
    });
    if (error) {
      if (error.message.includes("SELF_INTENT")) {
        return fail("You can't react to your own post that way", 409);
      }
      if (error.message.includes("CANNOT_INTEND_POST")) {
        return fail("Posts don't support that reaction", 400);
      }
      if (error.message.includes("POST_NOT_FOUND")) return fail("Post not found", 404);
      return fail(error.message, 500);
    }
    const isActive = (data as { isActive: boolean }).isActive;
    return ok(data, isActive ? "Reaction added" : "Reaction removed");
  } catch (e) {
    console.error("POST /api/intent error:", e);
    return fail("Internal server error", 500);
  }
}
