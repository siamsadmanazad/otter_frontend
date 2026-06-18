import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve a tribe by id OR serial (the client may pass either) -> { id, serial, created_by }
async function resolveTribe(db: ReturnType<typeof createAdminClient>, idOrSerial: string) {
  if (!idOrSerial || !UUID_RE.test(idOrSerial)) return null;
  const { data } = await db
    .from("tribes")
    .select("id, serial, created_by")
    .or(`id.eq.${idOrSerial},serial.eq.${idOrSerial}`)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// GET /api/tribe/join?userId=&tribeId=&requestType=memberCheck -> { isMember, isAdmin }
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const sp = request.nextUrl.searchParams;
  if (sp.get("requestType") !== "memberCheck") {
    return ok({ isMember: false, isAdmin: false }, "get tribe members");
  }
  try {
    const tribeRef = sp.get("tribeId") ?? "";
    const userId = sp.get("userId") || user.id;
    const db = createAdminClient();
    const tribe = await resolveTribe(db, tribeRef);
    if (!tribe) return fail("Tribe not found", 404);

    const { count } = await db
      .from("tribe_members")
      .select("user_id", { count: "exact", head: true })
      .eq("tribe_id", tribe.id)
      .eq("user_id", userId);
    const isMember = (count ?? 0) > 0;
    const isAdmin = tribe.created_by === userId;
    return ok(
      { isMember, isAdmin },
      isMember || isAdmin ? "Checked tribe membership" : "Failed checking tribe membership",
      isMember || isAdmin ? 200 : 400
    );
  } catch (e) {
    console.error("GET /api/tribe/join error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/tribe/join  body { tribeId } -> join/leave (join_or_leave_tribe RPC) -> { isMember, membersCount }
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const { tribeId } = await request.json();
    const db = createAdminClient();
    const tribe = await resolveTribe(db, tribeId);
    if (!tribe) return fail("Tribe not found", 404);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("join_or_leave_tribe", { p_serial: tribe.serial });
    if (error) return fail(error.message, 500);
    const isMember = (data as { isMember: boolean }).isMember;
    return ok(data, isMember ? "Joined tribe" : "Left tribe");
  } catch (e) {
    console.error("POST /api/tribe/join error:", e);
    return fail("Failed joining tribe", 500);
  }
}
