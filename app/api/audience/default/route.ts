import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// The remembered per-content-type audience (audiences.md 0.5) -- what the
// Stories composer's publish control defaults to, so posting to the usual
// audience costs zero taps (stories.md 1.5).

const CONTENT_TYPES = new Set(["STORY", "POST"]);
const MODES = new Set(["EVERYONE", "FOLLOWERS", "GROUP", "ONLY_ME"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/audience/default?type=STORY -> get_audience_default()
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);
    const type = (request.nextUrl.searchParams.get("type") || "").toUpperCase();
    if (!CONTENT_TYPES.has(type)) return fail("Invalid content type", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_audience_default", {
      p_content_type: type,
    });
    if (error) return fail(error.message, 500);
    return ok(data, "Default retrieved");
  } catch (e) {
    console.error("GET /api/audience/default error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/audience/default -> remember the last-used audience.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);
    const body = await request.json();
    const type = (body.contentType || "").toUpperCase();
    if (!CONTENT_TYPES.has(type)) return fail("Invalid content type", 400);
    const mode = (body.mode || "").toUpperCase();
    if (!MODES.has(mode)) return fail("Invalid audience", 400);
    const groupId: string | null = body.groupId || null;
    if (mode === "GROUP") {
      if (!groupId) return fail("Pick a group", 400);
      if (!UUID_RE.test(groupId)) return fail("Invalid group ID", 400);
    }

    const supabase = await createActorClient(request);
    const { error } = await supabase.rpc("set_audience_default", {
      p_content_type: type,
      p_mode: mode,
      p_group: mode === "GROUP" ? groupId : null,
    });
    if (error) {
      if (error.message.includes("FORBIDDEN")) return fail("That group isn't yours", 403);
      return fail(error.message, 500);
    }
    return ok(null, "Saved");
  } catch (e) {
    console.error("POST /api/audience/default error:", e);
    return fail("Internal server error", 500);
  }
}
