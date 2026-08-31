/**
 * One-off: seed real Stories across several demo personas so OStad can
 * manually browse the rail/DM rings/RadarNodeSheet strip/tribe strip/
 * profile chip with real varied content. Not idempotent by design — run
 * once, inspect, re-run --purge to remove everything this script created.
 *
 * Usage:
 *   node scripts/seed_stories_demo.mjs
 *   node scripts/seed_stories_demo.mjs --purge
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeLocalMediaFactory } from "./lib/local_fixture_media.mjs";

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
const SERVICE_ROLE_KEY =
  process.env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY (env or .env.local).");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
// PERFORMANCE.md P1-11: locally-generated, not a third-party host.
const localImage = makeLocalMediaFactory({
  url: SUPABASE_URL,
  serviceRoleKey: SERVICE_ROLE_KEY,
});

const PURGE = process.argv.includes("--purge");
const TAG = "demo-stories-seed"; // marker used only in alt_text so --purge can find them

const PERSONA_KEYS = [
  "atlas_marco",
  "neon_zara",
  "wild_rowan",
  "suite_victoria",
  "shoestring_sam",
  "umami_kenji",
  "sendit_tariq",
  "async_lena",
  "oldsoul_amara",
  "goldenhour_noah",
];

const img = (seed, w = 1080, h = 1440) => localImage(seed, w, h);

async function main() {
  if (PURGE) {
    const { data, error } = await db
      .from("stories")
      .delete()
      .like("alt_text", `%${TAG}%`)
      .select("id");
    if (error) throw error;
    console.log(`Purged ${data?.length ?? 0} demo stories.`);
    return;
  }

  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select("id, username, full_name")
    .in(
      "username",
      PERSONA_KEYS.map((k) => k) // usernames match the persona keys per seed_personas.mjs
    );
  if (pErr) throw pErr;
  const byUsername = new Map(profiles.map((p) => [p.username, p]));
  console.log(`Found ${profiles.length}/${PERSONA_KEYS.length} personas by username.`);

  // Fall back: some usernames may differ slightly; fetch all and fuzzy-match.
  if (profiles.length < PERSONA_KEYS.length) {
    const { data: all } = await db.from("profiles").select("id, username, full_name");
    for (const key of PERSONA_KEYS) {
      if (byUsername.has(key)) continue;
      const hit = all?.find((p) => p.username?.includes(key.split("_")[1]));
      if (hit) byUsername.set(key, hit);
    }
  }

  const { data: places } = await db
    .from("radar_places")
    .select("id, title, h3_index, h3_index_coarse")
    .limit(5);
  const { data: tribes } = await db.from("tribes").select("id, name").limit(5);

  console.log(`Places available: ${places?.map((p) => p.title).join(", ")}`);
  console.log(`Tribes available: ${tribes?.map((t) => t.name).join(", ")}`);

  const rows = [];
  let i = 0;
  for (const key of PERSONA_KEYS) {
    const p = byUsername.get(key);
    if (!p) {
      console.warn(`No profile found for ${key}, skipping.`);
      continue;
    }
    i += 1;
    const url = await img(key + i);
    const place = places?.[i % (places.length || 1)];
    const tribe = tribes?.[i % (tribes.length || 1)];
    const taggedPlace = i % 3 === 0 && place;
    const taggedTribe = !taggedPlace && i % 3 === 1 && tribe;

    rows.push({
      author_profile_id: p.id,
      media_url: url,
      media_path: `demo-seed/${p.id}/${i}.jpg`,
      alt_text: `${TAG} — a moment from ${p.full_name || key}`,
      place_id: taggedPlace ? place.id : null,
      h3_index: taggedPlace ? place.h3_index : null,
      h3_index_coarse: taggedPlace ? place.h3_index_coarse : null,
      tribe_id: taggedTribe ? tribe.id : null,
      audience_mode: "EVERYONE",
      duration_hours: 24,
    });
  }

  if (rows.length === 0) {
    console.error("No rows to insert — persona lookup failed.");
    process.exit(1);
  }

  const { data: inserted, error: iErr } = await db.from("stories").insert(rows).select("id, author_profile_id, place_id, tribe_id");
  if (iErr) throw iErr;
  console.log(`Inserted ${inserted.length} demo stories:`);
  for (const r of inserted) {
    console.log(`  ${r.id} author=${r.author_profile_id} place=${r.place_id ?? "-"} tribe=${r.tribe_id ?? "-"}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
