import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/activities/showcase/:userId -> user_trails_showcase()
//
// The profile "trophy case" read: progression + audience-filtered badges +
// personal records + visibility-filtered recent activities, in one round
// trip (see 20260829120000_otter_trails_showcase.sql's own header for why
// this exists as a single bundled RPC). Public-by-default per OStad's
// decision (2026-08-29) -- the RPC itself does the visibility filtering, this
// route is a thin wrapper, same shape as /api/activities/[id].

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    const me = await getServerUser(request);
    if (!me) return fail("Unauthorized", 401);

    const { userId } = await ctx.params;
    if (!UUID_RE.test(userId)) return fail("Invalid user ID", 400);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 6, 1), 30) : 6;

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("user_trails_showcase", {
      p_user_id: userId,
      p_activities_limit: limit,
    });
    if (error) return fail(error.message, 500);

    return ok(data, "Showcase fetched");
  } catch (e) {
    console.error("GET /api/activities/showcase/[userId] error:", e);
    return fail("Internal server error", 500);
  }
}
