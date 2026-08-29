/**
 * TripOtter · Otter Trails · Alice demo activities
 * (/Users/azad/.claude/plans/lazy-forging-giraffe.md Phase 6)
 *
 * Gives Alice (the a@a.co fast-login account) a real, populated Trails
 * profile — 5 synthetic activities, submitted through the REAL
 * `save_activity()` RPC while genuinely signed in as Alice, not inserted
 * directly into `activities`/`activity_tracks`. That is a deliberate
 * difference from the Phase 9 density seed
 * (20260828200000_otter_trails_phase9_density_seed.sql), which bypasses
 * save_activity() on purpose because it needs inert rows for a leaderboard,
 * not a genuine achievement history. Here the whole point is that
 * XP/level/badge/PR/quest logic actually fires, exactly as it would for any
 * real user, so the profile trophy case has something real to show.
 *
 * Sized deliberately to clear all 4 seeded example quests
 * (20260828160000_otter_trails_challenges.sql):
 *   - "First 5K"        (any type, >=5km)     -> activity 1 (hike, ~6.1km)
 *   - "Hill Starter"     (HIKE, >=150m gain)   -> activity 1 (~310m gain)
 *   - "20K Cyclist"      (CYCLE, >=20km total) -> activities 2+3 (~12.4+10.2km)
 *   - "Getting Started"  (>=3 activities)      -> activity 3
 * Plus the organic milestone badges: first_activity, first_activity_type:*
 * (one per type used), and activity_count_5 (exactly 5 activities seeded).
 *
 * Idempotent: checks (service role, PostgREST count) for any activity
 * already tagged `note = 'ALICE_DEMO_SEED'` and skips entirely if found.
 *
 * Usage:
 *   node scripts/seed_alice_trails.mjs
 *
 * Needs Node 22+ (see [[demo-personas-seed]] — supabase-js's RealtimeClient
 * needs native WebSocket, absent on Node 20).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    const out = {};
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}
const env = loadEnvLocal();
const SUPABASE_URL = process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY (env or .env.local).");
  process.exit(1);
}

const ALICE_ID = "3036b1b0-b889-43e9-945d-b3700beb96b5";
const ALICE_EMAIL = "a@a.co";
const ALICE_PASSWORD = "123456";
const SEED_NOTE = "ALICE_DEMO_SEED";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Geometry helpers ─────────────────────────────────────────────────────
// Simple equirectangular walk along a bearing — good enough for a few km of
// synthetic track, not survey-grade, which is exactly the Phase 9 seed's own
// standard ("geometry is synthetic -- this is test data, not a real recorded
// ride").
const METERS_PER_DEG_LAT = 111_320;
function metersPerDegLng(lat) {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/**
 * Builds a `[[lat,lng,elevation,tOffsetSeconds],...]` track that walks along
 * `bearingDeg` from (startLat,startLng) for `totalMeters` at `speedMps`,
 * emitting one point every `stepSec`. `elevationFn(fractionDone)` returns
 * elevation in meters at each point (default flat, sea-level-ish Dhaka).
 */
function buildTrack({
  startLat,
  startLng,
  bearingDeg,
  totalMeters,
  speedMps,
  stepSec = 15,
  elevationFn = () => 8,
}) {
  const totalSec = Math.round(totalMeters / speedMps);
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const points = [];
  for (let t = 0; t <= totalSec; t += stepSec) {
    const dist = speedMps * t;
    const dLat = (Math.cos(bearingRad) * dist) / METERS_PER_DEG_LAT;
    const dLng = (Math.sin(bearingRad) * dist) / metersPerDegLng(startLat);
    const lat = startLat + dLat;
    const lng = startLng + dLng;
    const elevation = elevationFn(dist / totalMeters);
    points.push([Number(lat.toFixed(6)), Number(lng.toFixed(6)), elevation, t]);
  }
  return points;
}

function daysAgo(n, hour = 7, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function endTime(startedAt, track) {
  const lastT = track[track.length - 1][3];
  return new Date(startedAt.getTime() + lastT * 1000);
}

function trackDistanceMeters(track) {
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    const [lat1, lng1] = track[i - 1];
    const [lat2, lng2] = track[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    total += 6_371_000 * 2 * Math.asin(Math.sqrt(a));
  }
  return total;
}

// ── The 5 activities ─────────────────────────────────────────────────────
// Dhaka-area starting points, spread across the last ~2 weeks so the profile
// doesn't look like it was all recorded in one second.
const ACTIVITIES = [
  {
    // Sitakunda-flavoured hike — gains real elevation to clear "Hill
    // Starter", and is long enough alone to clear "First 5K".
    type: "HIKE",
    title: "Sitakunda ridge morning hike",
    startedAt: daysAgo(12, 6),
    track: buildTrack({
      startLat: 22.635,
      startLng: 91.66,
      bearingDeg: 35,
      totalMeters: 6100,
      speedMps: 1.1, // ~4 km/h, real hiking pace
      elevationFn: (f) => 8 + Math.round(310 * Math.sin(Math.min(f, 1) * Math.PI)),
    }),
  },
  {
    type: "CYCLE",
    title: "Hatirjheel evening ride",
    startedAt: daysAgo(9, 17),
    track: buildTrack({
      startLat: 23.7509,
      startLng: 90.4076,
      bearingDeg: 120,
      totalMeters: 12400,
      speedMps: 5.6, // ~20 km/h
    }),
  },
  {
    type: "CYCLE",
    title: "Dhanmondi loop",
    startedAt: daysAgo(6, 7),
    track: buildTrack({
      startLat: 23.7461,
      startLng: 90.3742,
      bearingDeg: 200,
      totalMeters: 10200,
      speedMps: 5.2,
    }),
  },
  {
    type: "RUN",
    title: "Ramna Park morning run",
    startedAt: daysAgo(3, 6, 30),
    track: buildTrack({
      startLat: 23.7367,
      startLng: 90.4,
      bearingDeg: 300,
      totalMeters: 4200,
      speedMps: 2.7, // ~6:10/km
    }),
  },
  {
    type: "WALK",
    title: "Sunday evening walk",
    startedAt: daysAgo(1, 18),
    track: buildTrack({
      startLat: 23.744,
      startLng: 90.3785,
      bearingDeg: 80,
      totalMeters: 2100,
      speedMps: 1.3,
    }),
  },
  {
    // Deliberately last and CYCLE-typed: with quests started (below) but the
    // first 5 activities predating that start, criteria that check "this
    // save's own distance" (First 5K) or "cumulative CYCLE distance so far"
    // (20K Cyclist, already >20km from activities 2+3) only ever evaluate at
    // save time — so one more save is what actually completes them, exactly
    // as it would for a real user who starts a quest after already being
    // most of the way there. >=5km clears "First 5K" outright; being the
    // 6th completed activity clears "Getting Started"; being CYCLE-typed
    // re-triggers the "20K Cyclist" cumulative check.
    type: "CYCLE",
    title: "Today's spin around the lake",
    startedAt: daysAgo(0, 7),
    track: buildTrack({
      startLat: 23.7461,
      startLng: 90.3742,
      bearingDeg: 20,
      totalMeters: 5400,
      speedMps: 5.0,
    }),
  },
];

// Quest completion (save_activity()'s own logic, 20260828160000) only ever
// checks quests that ALREADY have an IN_PROGRESS quest_progress row — same
// rule as visit_place/meet_explorers. In the real app that row is created
// when a quest is surfaced nearby on Radar; a seed script has no Radar
// session to do that, so it starts them directly here, exactly the state
// Alice would be in had she opened Radar near one of these quests first.
// Confirmed via a live query against hosted (not a guess): a fresh
// save_activity() call that met "First 5K"'s and "20K Cyclist"'s criteria
// completed neither, because neither had ever been started — only "Hill
// Starter" had a pre-existing IN_PROGRESS row (from earlier manual testing).
const QUESTS_TO_START = ["First 5K", "Getting Started", "20K Cyclist"];

async function startQuests() {
  const { data: quests, error } = await admin
    .from("radar_quests")
    .select("id, title")
    .in("title", QUESTS_TO_START);
  if (error) throw error;

  for (const q of quests ?? []) {
    const { data: existing } = await admin
      .from("quest_progress")
      .select("id")
      .eq("user_id", ALICE_ID)
      .eq("quest_id", q.id)
      .maybeSingle();
    if (existing) continue;
    const { error: insertError } = await admin
      .from("quest_progress")
      .insert({ user_id: ALICE_ID, quest_id: q.id, status: "IN_PROGRESS", progress: {} });
    if (insertError) console.error(`Could not start quest "${q.title}":`, insertError.message);
  }
}

// Per-activity idempotency (by title, under the seed's own note) rather than
// a whole-script guard — safe to re-run after editing ACTIVITIES (e.g. this
// file's own 6th "top-up" activity was added after the first 5 were already
// live on hosted; a whole-script guard would have silently skipped it).
async function alreadySavedTitles() {
  const { data, error } = await admin
    .from("activities")
    .select("title")
    .eq("user_id", ALICE_ID)
    .eq("note", SEED_NOTE);
  if (error) throw error;
  return new Set((data ?? []).map((a) => a.title));
}

async function main() {
  const existingTitles = await alreadySavedTitles();
  const pending = ACTIVITIES.filter((a) => !existingTitles.has(a.title));
  if (pending.length === 0) {
    console.log("Already seeded — nothing new to add.");
    return;
  }

  await startQuests();

  const auth = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInError } = await auth.auth.signInWithPassword({
    email: ALICE_EMAIL,
    password: ALICE_PASSWORD,
  });
  if (signInError) {
    console.error("Could not sign in as Alice:", signInError.message);
    process.exit(1);
  }

  for (const activity of pending) {
    const distance = trackDistanceMeters(activity.track);
    const movingSeconds = activity.track[activity.track.length - 1][3];
    const ended = endTime(activity.startedAt, activity.track);

    const { data, error } = await auth.rpc("save_activity", {
      p_activity_type: activity.type,
      p_started_at: activity.startedAt.toISOString(),
      p_ended_at: ended.toISOString(),
      p_points: activity.track,
      p_moving_seconds: movingSeconds,
      p_elevation_source: activity.type === "HIKE" ? "GPS" : "NONE",
      p_raw_point_count: activity.track.length,
      p_gps_accuracy_avg: 8,
      p_client_distance: distance,
      p_title: activity.title,
      p_note: SEED_NOTE,
      p_visibility: "PUBLIC",
    });

    if (error) {
      console.error(`✗ ${activity.title}:`, error.message);
      continue;
    }
    const badges = (data?.badgesAwarded ?? []).map((b) => b.badgeKey).join(", ") || "none";
    const quests = (data?.questsCompleted ?? []).map((q) => q.title ?? q.questId).join(", ") || "none";
    console.log(
      `✓ ${activity.title} — ${(distance / 1000).toFixed(1)}km, +${data?.xpAwarded ?? 0}XP` +
        `${data?.leveledUp ? ` (level up -> ${data.levelLabel})` : ""}. Badges: ${badges}. Quests: ${quests}.`,
    );
  }

  console.log("\nDone. Sign in as a@a.co / 123456 in the app to see Alice's Trails profile.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
