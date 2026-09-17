import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/bloom -> the month's Bloom, and this caller's part in it.
//
// docs/achievement_tree.md Phase 8. Actor client, not admin: bloom_status()
// takes no arguments and reads current_profile_id() from the JWT, which is the
// rule finding F16 left behind — a SECURITY DEFINER function must never take
// the identity it acts on as an argument.
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  try {
    const db = await createActorClient(request);
    const { data, error } = await db.rpc("bloom_status");
    if (error) return fail(error.message, 500);
    // A month with no Bloom is an ordinary state, not an error: seasons are
    // content, and content runs out. The client renders nothing.
    return ok(data ?? {}, "Bloom");
  } catch (e) {
    console.error("GET /api/bloom error:", e);
    return fail("Internal server error", 500);
  }
}
