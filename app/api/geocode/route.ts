import { NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// GET /api/geocode?q=<free text>
// Business Mode Phase 6.4 (closes G1 fully) — forward geocoding via MapTiler,
// the map vendor the app already pays for (MAP_STYLE_URL). Used only by the
// pin-drop location pickers (business setup wizard 1.3, composer 3.3) to jump
// the map camera to a typed place name; the pin itself (not this endpoint's
// coordinates) remains the source of truth for what gets saved, so a bad or
// approximate geocode is a UX inconvenience, never a data-integrity issue.
// Auth-gated (not public like /api/offerings/search) because it costs a paid
// MapTiler call per request and is only ever reached from behind a
// business-setup/composer flow that already requires sign-in.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return ok([], "Query too short");

    const limited = await enforceRateLimit("geocode", user.id, request, 20, 60);
    if (limited) return limited;

    const apiKey = process.env.MAPTILER_API_KEY;
    if (!apiKey) return fail("Location search is not configured", 503);

    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${apiKey}&limit=6&language=en&country=bd`;
    const res = await fetch(url);
    if (!res.ok) return fail("Geocoding lookup failed", 502);

    const json = await res.json();
    const features = Array.isArray(json?.features) ? json.features : [];
    const results = features
      .filter((f: any) => Array.isArray(f?.center) && f.center.length === 2)
      .map((f: any) => ({
        placeName: f.place_name as string,
        text: f.text as string,
        lng: f.center[0] as number,
        lat: f.center[1] as number,
      }));

    return ok(results, "Geocoding results");
  } catch (e) {
    console.error("GET /api/geocode error:", e);
    return fail("Internal server error", 500);
  }
}
