import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// Otter Trails -- one activity + its route polyline.
//
// ⚠️ Reads go through the activity_detail() RPC, never a direct select on
// activity_tracks. That RPC is where privacy-zone trimming happens (the first
// and last 200m are clipped for every non-owner, decision D1). Selecting the
// track table directly here would bypass the trim and leak home addresses.
// activity_detail() returns null both when the row is missing and when the
// caller may not see it, so a prober cannot tell the two apart -- keep the 404
// below identical for both cases.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

// GET /api/activities/:id -> activity_detail()
export async function GET(request: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail("Invalid activity ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("activity_detail", { p_id: id });
    if (error) return fail(error.message, 500);
    if (!data) return fail("Activity not found", 404);

    return ok(data, "Activity retrieved");
  } catch (e) {
    console.error("GET /api/activities/[id] error:", e);
    return fail("Internal server error", 500);
  }
}

// PATCH /api/activities/:id -- rename / re-note / change visibility.
// Deliberately cannot touch any metric: distance, elevation and speed are
// server-computed evidence (§54), not user-editable fields.
export async function PATCH(request: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail("Invalid activity ID", 400);

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    if (typeof body.title === "string") patch.title = body.title.slice(0, 120).trim() || null;
    if (typeof body.note === "string") patch.note = body.note.slice(0, 2000).trim() || null;
    if (typeof body.visibility === "string") {
      const v = body.visibility.toUpperCase();
      if (!["PRIVATE", "FOLLOWERS", "PUBLIC"].includes(v)) {
        return fail("Invalid visibility", 400);
      }
      patch.visibility = v;
    }
    if (Object.keys(patch).length === 0) return fail("Nothing to update", 400);

    // RLS (activities_update_own) is the real gate here -- a non-owner's update
    // simply matches no rows rather than being rejected, which is why we check
    // the returned row rather than trusting the absence of an error.
    const supabase = await createActorClient(request);
    const { data, error } = await supabase
      .from("activities")
      .update(patch)
      .eq("id", id)
      .select("id, title, note, visibility")
      .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data) return fail("Activity not found", 404);

    return ok(data, "Activity updated");
  } catch (e) {
    console.error("PATCH /api/activities/[id] error:", e);
    return fail("Internal server error", 500);
  }
}

// DELETE /api/activities/:id -- removes the geometry too (activity_tracks
// cascades), per D1: deleting an activity must delete the route, not just hide it.
export async function DELETE(request: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) return fail("Invalid activity ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase
      .from("activities")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data) return fail("Activity not found", 404);

    return ok({ id }, "Activity deleted");
  } catch (e) {
    console.error("DELETE /api/activities/[id] error:", e);
    return fail("Internal server error", 500);
  }
}
