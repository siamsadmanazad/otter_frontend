import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const H3_RE = /^[0-9a-f]{15,16}$/;
// Guard against an unbounded IN list (k=6 ≈ 169 cells; allow headroom).
const MAX_CELLS = 512;

// POST /api/radar/nearby  body: { cells: string[], filters?: object }
// Returns aggregated, fuzzed nearby data (people counts + places + tribes) for
// the caller's client-computed k-ring, via the radar_nearby RPC. Never returns
// raw presence or identities — the RPC enforces the min-aggregation floor and
// ghost/self exclusion. Spatial ring→bucket mapping is done client-side.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const raw = Array.isArray(body?.cells) ? body.cells : [];
    // Sanitise: keep only valid, unique H3 hex cells, capped.
    const cells = Array.from(
      new Set(
        raw.filter((c: unknown): c is string => typeof c === "string" && H3_RE.test(c))
      )
    ).slice(0, MAX_CELLS);

    if (cells.length === 0) {
      return ok({ people: [], individuals: [], places: [], tribes: [] }, "No cells");
    }

    const filters =
      body?.filters && typeof body.filters === "object" ? body.filters : {};

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_nearby", {
      p_cells: cells,
      p_filters: filters,
    });
    if (error) return fail(error.message, 500);

    return ok(data ?? { people: [], individuals: [], places: [], tribes: [] }, "Nearby");
  } catch (e) {
    console.error("POST /api/radar/nearby error:", e);
    return fail("Failed loading nearby", 500);
  }
}
