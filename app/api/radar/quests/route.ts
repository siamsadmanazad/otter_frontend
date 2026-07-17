import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const H3_RE = /^[0-9a-f]{15,16}$/;
const MAX_CELLS = 512;

// GET /api/radar/quests?cells=h3,h3,...
// Active quests (global, or place-anchored within the passed cells) with the
// caller's status/progress joined in, via radar_quests_nearby (Otter Radar
// Phase 6.2). Cells are the same client-computed k-ring used by /api/radar/nearby.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const raw = request.nextUrl.searchParams.get("cells") ?? "";
    const cells = Array.from(
      new Set(
        raw
          .split(",")
          .map((c) => c.trim())
          .filter((c) => H3_RE.test(c))
      )
    ).slice(0, MAX_CELLS);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_quests_nearby", {
      p_cells: cells.length > 0 ? cells : null,
    });
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Quests");
  } catch (e) {
    console.error("GET /api/radar/quests error:", e);
    return fail("Failed loading quests", 500);
  }
}
