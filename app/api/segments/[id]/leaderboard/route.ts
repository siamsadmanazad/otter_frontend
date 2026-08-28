import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const SCOPES = new Set(["ALL", "FRIENDS", "TRIBE"]);

// GET /api/segments/:id/leaderboard?scope=ALL|FRIENDS|TRIBE&tribeId=&limit=
// -> segment_leaderboard() (Otter Trails Phase 9, gamify.md §11/§39).
// Deliberately no geographic/global scope option -- Part 5's own instruction,
// that needs city-wide density this feature does not have.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    const scope = (request.nextUrl.searchParams.get("scope") ?? "ALL").toUpperCase();
    if (!SCOPES.has(scope)) return fail("Invalid scope", 400);

    const tribeId = request.nextUrl.searchParams.get("tribeId");
    if (scope === "TRIBE" && !tribeId) return fail("tribeId is required for a tribe leaderboard", 400);

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("segment_leaderboard", {
      p_segment_id: id,
      p_scope: scope,
      p_tribe_id: scope === "TRIBE" ? tribeId : null,
      p_limit: limit,
    });
    if (error) return fail(error.message, 500);

    return ok(data ?? [], "Leaderboard retrieved");
  } catch (e) {
    console.error("GET /api/segments/[id]/leaderboard error:", e);
    return fail("Internal server error", 500);
  }
}
