import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail, mapTribe } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { timeRoute } from "@/lib/observability";

// GET /api/tribe/nearby?lat=&lng=&radiusKm=&limit=
//
// Public tribes physically anchored near the viewer's coordinates, nearest
// first — the tribes-side equivalent of Radar's nearby view. Unauthenticated
// like /api/tribe/search (this is public discovery data, PUBLIC tribes only,
// same as that route), but rate-limited on IP since it takes client-supplied
// coordinates straight into a distance query (PERFORMANCE.md P0-2 pattern).
export const GET = timeRoute("tribe.nearby", async (request: NextRequest): Promise<Response> => {
  const user = await getServerUser(request).catch(() => null);
  const limited = await enforceRateLimit("tribe_nearby", user?.id ?? null, request, 30, 60);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return fail("Valid lat/lng query params are required", 400);
  }
  const radiusKm = Math.min(200, Math.max(1, Number(sp.get("radiusKm")) || 50));
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit")) || 20));

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("nearby_tribes", {
      p_lat: lat,
      p_lng: lng,
      p_radius_km: radiusKm,
      p_limit: limit,
    });
    if (error) throw error;

    const tribes = ((data ?? []) as any[]).map((row) => ({
      ...mapTribe(row),
      distanceKm: row.distance_km,
    }));
    return ok(tribes, "Get nearby tribes");
  } catch (e) {
    console.error("GET /api/tribe/nearby error:", e);
    return fail("Internal server error", 500);
  }
});
