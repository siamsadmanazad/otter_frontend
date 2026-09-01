import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// GET /api/places/search?q=<text>&cells=<comma-separated H3 hex>
//
// composers_implementation.md §8.3 -- one endpoint the place picker
// (widgets/place_picker_sheet.dart) uses for both its modes, and the one
// future web parity (Phase 6) will reuse:
//  - no `q`: nearby places for the caller-supplied H3 cells. The client
//    computes its own k-ring on-device (same as radarRepository.nearbyPlacesRaw
//    already does) and passes the resulting cells here.
//  - with `q`: radar_places title match UNION /api/geocode's own MapTiler
//    lookup, radar places first, deduped by proximity. NEVER creates a
//    radar_places row (composers_implementation.md D11) -- a geocode hit is
//    always returned with placeId: null.
//
// `h3` on a GEOCODE row is deliberately null: this app computes H3 entirely
// on-device (nearbysearch.md §0.2 -- the server holds no h3 extension), so
// the client derives it itself via RadarLocationService.cellForCoords, the
// same helper widgets/place_picker_sheet.dart already calls for a geocoded
// pick.
type PlaceResult = {
  placeId: string | null;
  name: string;
  subtitle: string | null;
  lat: number | null;
  lng: number | null;
  h3: string | null;
  source: "RADAR" | "GEOCODE";
};

const DEDUPE_DEGREES = 0.0005; // ~50m -- close enough to call it the same place

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("places_search", user.id, request, 20, 60);
    if (limited) return limited;

    const sp = request.nextUrl.searchParams;
    const q = sp.get("q")?.trim() ?? "";
    const cells = (sp.get("cells") ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 200); // same headroom cap radar/nearby uses for its own cell list

    if (!q && cells.length === 0) return ok([], "No query or cells supplied");

    const db = createAdminClient();
    let radarQuery = db
      .from("radar_places")
      .select("id, title, subtitle, lat, lng, h3_index")
      .eq("is_active", true)
      .limit(20);
    radarQuery = q ? radarQuery.ilike("title", `%${q}%`) : radarQuery.in("h3_index", cells);

    const { data: radarRows, error: radarErr } = await radarQuery;
    if (radarErr) return fail(radarErr.message, 500);

    const results: PlaceResult[] = (radarRows ?? []).map((r) => ({
      placeId: r.id as string,
      name: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      lat: r.lat as number,
      lng: r.lng as number,
      h3: r.h3_index as string,
      source: "RADAR",
    }));

    // Geocode only makes sense for a text search, not a nearby-cells fetch.
    if (q.length >= 2) {
      const apiKey = process.env.MAPTILER_API_KEY;
      if (apiKey) {
        try {
          const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${apiKey}&limit=6&language=en&country=bd`;
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            const features = Array.isArray(json?.features) ? json.features : [];
            for (const f of features) {
              if (!Array.isArray(f?.center) || f.center.length !== 2) continue;
              const lng = f.center[0] as number;
              const lat = f.center[1] as number;
              const dupe = results.some(
                (r) =>
                  r.lat != null &&
                  r.lng != null &&
                  Math.abs(r.lat - lat) < DEDUPE_DEGREES &&
                  Math.abs(r.lng - lng) < DEDUPE_DEGREES
              );
              if (dupe) continue;
              results.push({
                placeId: null,
                name: (f.text as string) || (f.place_name as string) || q,
                subtitle: (f.place_name as string) ?? null,
                lat,
                lng,
                h3: null,
                source: "GEOCODE",
              });
            }
          }
        } catch (e) {
          // Fail open -- geocode is an enrichment on top of radar results,
          // never a reason to fail the whole search (same posture as the
          // Post composer's own link-unfurl step).
          console.warn("places/search: geocode lookup failed", e);
        }
      }
    }

    return ok(results, "Places found");
  } catch (e) {
    console.error("GET /api/places/search error:", e);
    return fail("Internal server error", 500);
  }
}
