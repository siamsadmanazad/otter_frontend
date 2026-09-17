import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/cosmetics -> what is on sale, what the caller owns, what they can spend.
//
// docs/achievement_tree.md Phase 10. Actor client: cosmetics_catalogue() takes
// no arguments and reads current_profile_id() (finding F16's rule).
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  try {
    const db = await createActorClient(request);
    const { data, error } = await db.rpc("cosmetics_catalogue");
    if (error) return fail(error.message, 500);
    return ok(data ?? {}, "Cosmetics");
  } catch (e) {
    console.error("GET /api/cosmetics error:", e);
    return fail("Internal server error", 500);
  }
}
