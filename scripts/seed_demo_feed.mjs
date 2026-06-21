/**
 * Themed demo feed for the profile-page showcase — fills Alice's profile with a
 * cool, adventurous beach/rave/festival feed so the collapsing hero has content
 * to scroll against. Idempotent: re-running replaces the #otterwave set.
 *
 * Uses PostgREST directly via fetch (no supabase-js → avoids the Node-20
 * WebSocket requirement). Reads NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY from .env.local (or SUPABASE_URL / SERVICE_ROLE_KEY).
 *
 * Usage: node scripts/seed_demo_feed.mjs
 */
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
const URL_BASE = (
  process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ""
).replace(/\/$/, "");
const KEY = process.env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY (env or .env.local).");
  process.exit(1);
}
const rest = `${URL_BASE}/rest/v1`;
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const MARKER = "#otterwave";
const img = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1080&q=80`;
const fallback = (i) => `https://picsum.photos/seed/otterwave${i}/1080/1080`;

const POSTS = [
  { id: "1507525428034-b723cf961d3e", type: "POST", location: "Tulum, Mexico",
    caption: `Golden hour, golden crew — beach volleyball then sundowners 🍹🌅 ${MARKER} #beachlife` },
  { id: "1530549387789-4c1017266635", type: "POST", location: "Mykonos, Greece",
    caption: `Beach club to afterparty. The island doesn't sleep and neither do we ✨🔊 ${MARKER} #rave` },
  { id: "1502680390469-be75c86b636f", type: "POST", location: "Ericeira, Portugal",
    caption: `Sunrise paddle-out before the crowds 🌊 nothing but salt and silence ${MARKER} #surf` },
  { id: "1533174072545-7a4b6ad7a6c3", type: "POST", location: "Ibiza, Spain",
    caption: `Catamaran day → rooftop night. Saltwater hair, don't care 🛥️🍸 ${MARKER} #boatparty` },
  { id: "1459749411175-04bf5292ceea", type: "POST", location: "Zrće Beach, Croatia",
    caption: `Lagoon swim, then the bass dropped at the beach stage 🔊🏝️ ${MARKER} #festival` },
  { id: "1506905925346-21bda4d32df4", type: "POST", location: "Wadi Rum, Jordan",
    caption: `Desert rave under a billion stars 🏜️🌌 sand still in my shoes ${MARKER} #festival` },
  { id: "1519046904884-53103b34b206", type: "POST", location: "Hvar, Croatia",
    caption: `Bikini, boat, bass — floating party off the coast all afternoon 🛥️🎶 ${MARKER}` },
  { id: "1533761504194-3eb9c01c0c9b", type: "POST", location: "Koh Phangan, Thailand",
    caption: `Full-moon madness 🌕 fire dancers and 5am tides ${MARKER} #fullmoon` },
  { id: "1502933691298-84fc14542831", type: "POST", location: "Canggu, Bali",
    caption: `Jungle trek by day, neon jungle by night 🌴⚡ ${MARKER} #adventure` },
  { id: "1520250497591-112f2f40a3f4", type: "POST", location: "Marbella, Spain",
    caption: `Pool party people 🦩 floaties, frosé and a DJ till midnight ${MARKER} #poolparty` },
  { id: "1544551763-46a013bb70d5", type: "POST", location: "Dahab, Egypt",
    caption: `Dove the blue hole this morning, dancing on the sand tonight 🤿💃 ${MARKER} #dive` },
  { id: "1414609245224-afa02bfb3fda", type: "JOURNAL", location: "Lisbon, Portugal",
    caption: `Three months, eleven beaches, zero alarm clocks — a love letter to the sea. ${MARKER}` },
];

async function ok(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  // Resolve Alice.
  const pRes = await fetch(
    `${rest}/profiles?username=eq.otter_alice&select=id,username`,
    { headers }
  );
  const profiles = await pRes.json();
  const alice = Array.isArray(profiles) ? profiles[0] : null;
  if (!alice) {
    console.error("Could not find demo user otter_alice.");
    process.exit(1);
  }
  console.log(`Seeding feed for ${alice.username} (${alice.id})`);

  // Idempotent: clear the previous wave set (match the marker substring).
  const delRes = await fetch(
    `${rest}/posts?owner_id=eq.${alice.id}&caption=ilike.*otterwave*`,
    { method: "DELETE", headers }
  );
  if (!delRes.ok) console.warn("Cleanup warning:", await delRes.text());

  // Verify images; swap failures for fallbacks so no tile renders broken.
  let swapped = 0;
  const rows = [];
  for (let i = 0; i < POSTS.length; i++) {
    const p = POSTS[i];
    const url = img(p.id);
    const good = await ok(url);
    if (!good) swapped++;
    rows.push({
      owner_id: alice.id,
      caption: p.caption,
      images: [good ? url : fallback(i)],
      post_type: p.type,
      location: p.location,
    });
  }

  const insRes = await fetch(`${rest}/posts`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  if (!insRes.ok) {
    console.error("Insert failed:", await insRes.text());
    process.exit(1);
  }
  const inserted = await insRes.json();
  console.log(
    `✓ Inserted ${inserted.length} posts (${swapped} image(s) fell back to Picsum).`
  );
}

main().then(() => process.exit(0));
