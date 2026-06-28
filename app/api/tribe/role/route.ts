import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = new Set(["MEMBER", "MODERATOR", "ADMIN", "FOUNDER"]);

// POST /api/tribe/role  body { tribeId|serial, targetUserId, role }
// Changes a member's role. Authorization (founder/admin only) is enforced inside
// the set_member_role RPC via auth.uid(), so it must run on the actor client.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const b = await request.json();
    const ref: string = b.serial ?? b.tribeId ?? "";
    const targetUserId: string = b.targetUserId ?? "";
    const role: string = b.role ?? "";
    if (!UUID_RE.test(ref)) return fail("Tribe id/serial is required", 400);
    if (!UUID_RE.test(targetUserId)) return fail("targetUserId is required", 400);
    if (!ROLES.has(role)) return fail("Invalid role", 400);

    // Resolve to a serial (the RPC keys on serial, like join_or_leave_tribe).
    const db = createAdminClient();
    const { data: tribe } = await db
      .from("tribes")
      .select("serial")
      .or(`id.eq.${ref},serial.eq.${ref}`)
      .limit(1)
      .maybeSingle();
    if (!tribe) return fail("Tribe not found", 404);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("set_member_role", {
      p_serial: tribe.serial,
      p_target: targetUserId,
      p_role: role,
    });
    if (error) {
      const denied = /FORBIDDEN|AUTH_REQUIRED|CANNOT_DEMOTE_FOUNDER/.test(error.message);
      return fail(error.message, denied ? 403 : 500);
    }
    return ok(data, "Role updated");
  } catch (e) {
    console.error("POST /api/tribe/role error:", e);
    return fail("Failed updating role", 500);
  }
}
