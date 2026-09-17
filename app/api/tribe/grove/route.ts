import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/tribe/grove?id=<tribeId> -> the tribe's collective badge coverage.
//
// docs/achievement_tree.md Phase 12. Actor client, because grove_status()
// authorises by MEMBERSHIP and reads the caller from the JWT. Note what it
// takes: a tribe id — a resource — never a user id. That distinction is the
// whole of finding F16's rule, and it is why passing an id here is safe when
// passing one to a reward function was not.
//
// The response carries badge keys with no owners attached. A ranking cannot be
// built from it by this route, by the client, or by anyone who intercepts it,
// because the information required to rank is not in the payload.
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return fail("id is required", 400);

  try {
    const db = await createActorClient(request);
    const { data, error } = await db.rpc("grove_status", { p_tribe: id });
    if (error) {
      if ((error.message || "").includes("FORBIDDEN")) {
        return fail("That grove is for the people in it.", 403);
      }
      return fail(error.message, 500);
    }
    return ok(data ?? {}, "Grove");
  } catch (e) {
    console.error("GET /api/tribe/grove error:", e);
    return fail("Internal server error", 500);
  }
}
