import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const H3_RE = /^[0-9a-f]{15,16}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/radar/rally
// body: { title, note?, placeId?, nicheId?, h3Index, h3IndexCoarse, ttlMinutes?,
//         kind? ('RALLY'|'ACTIVITY'), startsAt?, capacity? }
// Spins up a short-lived nearby rally — or, with kind:'ACTIVITY', a scheduled
// capacity-bounded Local Activity (Otter Radar Phase 6.3) — via
// radar_create_rally (rate-limited, auto-joins the host, broadcasts a
// live-buzz pulse). Rides radar_nearby so nearby explorers see and can join it.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 80) return fail("Invalid title", 400);

    const h3 = typeof body?.h3Index === "string" ? body.h3Index : "";
    const h3Coarse =
      typeof body?.h3IndexCoarse === "string" ? body.h3IndexCoarse : "";
    if (!H3_RE.test(h3) || !H3_RE.test(h3Coarse))
      return fail("Invalid location", 400);

    const note =
      typeof body?.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 280)
        : null;
    const placeId =
      typeof body?.placeId === "string" && UUID_RE.test(body.placeId)
        ? body.placeId
        : null;
    const nicheId =
      typeof body?.nicheId === "string" && UUID_RE.test(body.nicheId)
        ? body.nicheId
        : null;
    const ttl =
      typeof body?.ttlMinutes === "number" && Number.isFinite(body.ttlMinutes)
        ? Math.trunc(body.ttlMinutes)
        : 120;
    const kind = body?.kind === "ACTIVITY" ? "ACTIVITY" : "RALLY";
    const startsAt =
      typeof body?.startsAt === "string" && !Number.isNaN(Date.parse(body.startsAt))
        ? body.startsAt
        : null;
    const capacity =
      typeof body?.capacity === "number" &&
      Number.isFinite(body.capacity) &&
      body.capacity >= 1 &&
      body.capacity <= 500
        ? Math.trunc(body.capacity)
        : null;

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_create_rally", {
      p_h3_index: h3,
      p_h3_index_coarse: h3Coarse,
      p_title: title,
      p_note: note,
      p_place_id: placeId,
      p_niche_id: nicheId,
      p_ttl_minutes: ttl,
      p_kind: kind,
      p_starts_at: startsAt,
      p_capacity: capacity,
    });
    if (error) {
      const msg = error.message || "";
      if (/rate limited/i.test(msg))
        return fail("You’ve started a lot of rallies — take a breather 🎈", 429);
      return fail(msg, 500);
    }
    return ok(data, kind === "ACTIVITY" ? "Activity created" : "Rally started");
  } catch (e) {
    console.error("POST /api/radar/rally error:", e);
    return fail("Failed starting rally", 500);
  }
}
