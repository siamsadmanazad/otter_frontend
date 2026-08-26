import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const H3_RE = /^[0-9a-f]{15,16}$/;
const TYPES = new Set(["TOUR", "STAY", "EVENT", "CLASS", "RENTAL", "GUIDE", "TRANSPORT", "TABLE"]);
const VERIFICATION_TIERS = new Set(["UNVERIFIED", "CLAIMED", "ID_VERIFIED", "LICENCE_VERIFIED"]);
const MAX_CELLS = 512;

// GET /api/offerings/search?q=&nicheId=&type=&cells=a,b,c&limit=&minVerification=
// Business Mode Phase 4.1 (facet search) + 4.2 (location filtering) + 5.1
// (verification facet), via search_offerings(). Public (no auth required,
// matching search_all's own anon-allowed contract) -- offerings discovery is
// meant to be found by anyone, same as radar_nearby. `cells` is a
// client-computed h3 k-ring (device "near me" or a chosen place's ring);
// omit for a global search.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    const nicheIdRaw = request.nextUrl.searchParams.get("nicheId");
    const nicheId = nicheIdRaw && UUID_RE.test(nicheIdRaw) ? nicheIdRaw : null;

    const typeRaw = request.nextUrl.searchParams.get("type");
    const type = typeRaw && TYPES.has(typeRaw) ? typeRaw : null;

    const minVerificationRaw = request.nextUrl.searchParams.get("minVerification");
    const minVerification =
      minVerificationRaw && VERIFICATION_TIERS.has(minVerificationRaw) ? minVerificationRaw : null;

    const cellsRaw = request.nextUrl.searchParams.get("cells");
    const cells = cellsRaw
      ? Array.from(
          new Set(
            cellsRaw
              .split(",")
              .map((c) => c.trim())
              .filter((c) => H3_RE.test(c))
          )
        ).slice(0, MAX_CELLS)
      : null;

    const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("search_offerings", {
      p_query: q,
      p_niche_id: nicheId,
      p_type: type,
      p_cells: cells && cells.length > 0 ? cells : null,
      p_limit: limit,
      p_min_verification: minVerification,
    });
    if (error) return fail(error.message, 500);

    return ok(data ?? [], "Offerings search results");
  } catch (e) {
    console.error("GET /api/offerings/search error:", e);
    return fail("Internal server error", 500);
  }
}
