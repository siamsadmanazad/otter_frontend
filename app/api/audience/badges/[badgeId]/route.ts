import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// PATCH /api/audience/badges/:badgeId -> set_badge_audience()
//
// "Who can see this badge" (docs/audiences.md), reusing the exact same
// picker UI Stories already ships. Owner-only, enforced inside the RPC
// (auth.uid() -- badges are human-anchored, same as audience_groups).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES = new Set(["EVERYONE", "FOLLOWERS", "GROUP", "ONLY_ME"]);

type Ctx = { params: Promise<{ badgeId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { badgeId } = await ctx.params;
    if (!UUID_RE.test(badgeId)) return fail("Invalid badge ID", 400);

    const body = await request.json();
    const mode: string = body.mode;
    if (!MODES.has(mode)) return fail("Invalid audience mode", 400);
    const groupId: string | null = body.groupId || null;
    if (mode === "GROUP" && (!groupId || !UUID_RE.test(groupId))) {
      return fail("A group is required for GROUP mode", 400);
    }

    const supabase = await createActorClient(request);
    const { error } = await supabase.rpc("set_badge_audience", {
      p_badge_id: badgeId,
      p_mode: mode,
      p_group_id: mode === "GROUP" ? groupId : null,
    });
    if (error) {
      if (error.message.includes("NOT_FOUND")) return fail("Badge not found", 404);
      if (error.message.includes("INVALID_AUDIENCE_GROUP")) return fail("Invalid group", 400);
      return fail(error.message, 500);
    }
    return ok({ badgeId, mode, groupId: mode === "GROUP" ? groupId : null }, "Audience updated");
  } catch (e) {
    console.error("PATCH /api/audience/badges/[badgeId] error:", e);
    return fail("Internal server error", 500);
  }
}
