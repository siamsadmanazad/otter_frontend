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
    // Says what is actually wrong, because this is an OPERATIONAL fault (the
    // key is missing from the deployment), not a user error — and the picker
    // now shows this sentence verbatim. MAPTILER_API_KEY was absent from
    // production until 2026-09-07, which made every location search in the
    // service composer silently return nothing.
    if (!apiKey) {
      return fail("Location search isn't set up on this server yet.", 503);
    }

    // `country=bd` used to be a HARD filter here, so a search for anywhere
    // outside Bangladesh returned zero results with no explanation — on a
    // TRAVEL app, whose whole premise is hosts and travellers who are not in
    // one country. Replaced with a proximity bias: Bangladeshi places still
    // rank first (which is what the restriction was really trying to buy),
    // and Kathmandu, Bangkok and Cox's Bazar are all findable.
    const url =
      `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json` +
      `?key=${apiKey}&limit=6&language=en&proximity=90.4125,23.8103`;
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
