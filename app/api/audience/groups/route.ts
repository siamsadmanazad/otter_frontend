import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// audiences.md Phase 0 management surface, consumed first by the Stories
// composer's audience picker (stories.md 1.5: "creating a group is reachable
// from that picker but never blocks posting"). Groups anchor on the HUMAN
// (owner_id = user.id, never user.profileId) -- audiences.md's own rule, so a
// person's groups never fork when they switch to acting as their business.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/audience/groups -> my_audience_groups()
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("my_audience_groups");
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Groups retrieved");
  } catch (e) {
    console.error("GET /api/audience/groups error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/audience/groups -> create a group.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json();
    const name: string = (body.name || "").trim();
    if (!name) return fail("Give this group a name", 400);
    if (name.length > 40) return fail("Group names are at most 40 characters", 400);
    const glyph: string = (body.glyph || "people").trim() || "people";
    const colorHex: string | null = body.colorHex || null;
    if (colorHex && !/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
      return fail("Invalid color", 400);
    }

    const supabase = await createActorClient(request);
    const { data, error } = await supabase
      .from("audience_groups")
      .insert({ owner_id: user.id, name, glyph, color_hex: colorHex })
      .select()
      .single();
    if (error) {
      if (error.message.includes("AUDIENCE_GROUP_LIMIT")) {
        return fail("You've reached the limit of 20 groups", 400);
      }
      if (error.code === "23505") return fail("You already have a group with that name", 409);
      return fail(error.message, 500);
    }
    return ok(data, "Group created");
  } catch (e) {
    console.error("POST /api/audience/groups error:", e);
    return fail("Could not create that group", 500);
  }
}

// DELETE /api/audience/groups?id=<uuid> -> delete own group
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !UUID_RE.test(id)) return fail("Invalid group ID", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase
      .from("audience_groups")
      .delete()
      .eq("id", id)
      .select("id")
      .single();
    if (error || !data) return fail("Group not found", 404);
    return ok({ id }, "Deleted");
  } catch (e) {
    console.error("DELETE /api/audience/groups error:", e);
    return fail("Internal server error", 500);
  }
}
