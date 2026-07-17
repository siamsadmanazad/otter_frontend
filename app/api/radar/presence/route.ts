import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// Canonical H3 hex (res 9/6 are 15-char; allow 16 for other resolutions).
const H3_RE = /^[0-9a-f]{15,16}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/radar/presence
// body: { h3Index, h3IndexCoarse, nicheId?, isGhost? }
// Upserts the caller's fuzzed radar presence via the radar_upsert_presence RPC
// (SECURITY DEFINER, keyed on auth.uid()). When isGhost is true the RPC deletes
// the row instead. The client computes the H3 cells on-device — raw coordinates
// never reach the server (Otter Radar privacy law, nearbysearch.md §3).
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const isGhost = body?.isGhost === true;
    const h3Index = typeof body?.h3Index === "string" ? body.h3Index : "";
    const h3IndexCoarse =
      typeof body?.h3IndexCoarse === "string" ? body.h3IndexCoarse : "";
    const nicheId =
      typeof body?.nicheId === "string" && UUID_RE.test(body.nicheId)
        ? body.nicheId
        : null;
    // Opt-in wave-able visibility (Phase 5.2) — default off.
    const isWaveable = body?.isWaveable === true;

    // A ghost write needs no cells (the row is deleted); a live write must carry
    // valid fuzzed cells.
    if (!isGhost && (!H3_RE.test(h3Index) || !H3_RE.test(h3IndexCoarse))) {
      return fail("Invalid H3 index", 400);
    }

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_upsert_presence", {
      p_h3_index: isGhost ? "0" : h3Index,
      p_h3_index_coarse: isGhost ? "0" : h3IndexCoarse,
      p_niche_id: nicheId,
      p_is_ghost: isGhost,
      p_is_waveable: isWaveable,
    });
    if (error) return fail(error.message, 500);

    // questsCompleted (Otter Radar Phase 6.2): any visit_place quest this
    // heartbeat's cell just satisfied.
    return ok(
      { ghost: isGhost, questsCompleted: data?.questsCompleted ?? [] },
      isGhost ? "Presence cleared" : "Presence updated"
    );
  } catch (e) {
    console.error("POST /api/radar/presence error:", e);
    return fail("Failed updating presence", 500);
  }
}
