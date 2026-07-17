import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rallyId(request: NextRequest): Promise<string | null> {
  try {
    const body = await request.json();
    const id = typeof body?.rallyId === "string" ? body.rallyId : "";
    return UUID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

// POST /api/radar/rally/join  body: { rallyId }
// Join a nearby rally via radar_join_rally (block-checked, idempotent, refuses
// closed/expired). Returns { joined, participantCount, hostUserId }.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const id = await rallyId(request);
  if (!id) return fail("Invalid rally", 400);

  try {
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_join_rally", {
      p_rally_id: id,
    });
    if (error) {
      const msg = error.message || "";
      if (/blocked/i.test(msg)) return fail("You can’t join this rally", 403);
      if (/\bfull\b/i.test(msg)) return fail("This one’s full", 409);
      if (/closed/i.test(msg)) return fail("This rally has wrapped up", 409);
      if (/not found/i.test(msg)) return fail("Rally not found", 404);
      return fail(msg, 500);
    }
    return ok(data, "Joined rally");
  } catch (e) {
    console.error("POST /api/radar/rally/join error:", e);
    return fail("Failed joining rally", 500);
  }
}

// DELETE /api/radar/rally/join?rallyId=...
// Leave a rally via radar_leave_rally. The host leaving closes the rally.
export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const id = request.nextUrl.searchParams.get("rallyId");
  if (!id || !UUID_RE.test(id)) return fail("Invalid rally", 400);

  try {
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_leave_rally", {
      p_rally_id: id,
    });
    if (error) {
      const msg = error.message || "";
      if (/not found/i.test(msg)) return fail("Rally not found", 404);
      return fail(msg, 500);
    }
    return ok(data, "Left rally");
  } catch (e) {
    console.error("DELETE /api/radar/rally/join error:", e);
    return fail("Failed leaving rally", 500);
  }
}
