import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// docs/stories.md Phase 5.3 -- an author's kept stories, for the profile's
// Moments UI. Deliberately its own RPC/route, not a filter on
// GET /api/stories?author= -- see profile_highlights()'s own migration
// comment: opening a highlight must never mix in the author's current live
// ephemeral segments.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/stories/highlights?author=<uuid> -> profile_highlights()
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const author = request.nextUrl.searchParams.get("author");
    if (!author || !UUID_RE.test(author)) return fail("Invalid author ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("profile_highlights", { p_author: author });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Highlights retrieved");
  } catch (e) {
    console.error("GET /api/stories/highlights error:", e);
    return fail("Internal server error", 500);
  }
}
