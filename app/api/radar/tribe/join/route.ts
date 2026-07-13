import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/radar/tribe/join  body: { tribeId }
// Join a tribe from the radar with the Phase 5.4 achievement ceremony via the
// radar_join_tribe RPC: joins (or requests, for private tribes), and on a
// first-ever join awards an explorer_badge + OttiCash reward + notifies the
// founder. Returns { joined, firstTime, pending, reward, balanceMinor,
// badgeKey, membersCount, tribeName } — the client plays the celebration when
// firstTime is true.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const tribeId = typeof body?.tribeId === "string" ? body.tribeId : "";
    if (!UUID_RE.test(tribeId)) return fail("Invalid tribe", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_join_tribe", {
      p_tribe_id: tribeId,
    });
    if (error) {
      const msg = error.message || "";
      if (/not found/i.test(msg)) return fail("Tribe not found", 404);
      return fail(msg, 500);
    }
    return ok(data, "Joined tribe");
  } catch (e) {
    console.error("POST /api/radar/tribe/join error:", e);
    return fail("Failed joining tribe", 500);
  }
}
