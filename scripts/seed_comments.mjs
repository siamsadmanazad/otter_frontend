/**
 * Seed a realistic multi-user comment conversation on one of Alice's posts so
 * the redesigned comment section can be tested (threading feel, mentions, time).
 * Idempotent: skips if the target post already has comments. Run with Node 22+.
 *
 *   ~/.nvm/versions/node/v22.22.2/bin/node scripts/seed_comments.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function envLocal() {
  const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  const out = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = envLocal();
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALICE = "3036b1b0-b889-43e9-945d-b3700beb96b5";
const POST = "a279b241-3eb9-4ac7-bfad-5db4e510066a"; // "Golden hour hit different up here ✨"

const U = {
  marco: "cf787d5d-4d30-4e3f-9a5e-9ab04bbf7ce8",
  zara: "0f3b282e-06b6-4276-85e1-f50221c8468f",
  rowan: "9b35c66e-8b96-483b-aa52-dc80d0a68999",
  kenji: "57f4eb16-2b44-47ea-b2ee-83257aec57c5",
  tariq: "ad6abac5-2f3e-4a9e-8b8a-92351b9c79d3",
  lena: "37c3f796-6952-4ef7-8e60-ca793fbd033f",
  noah: "3f068a4c-5ddd-4ffc-9425-da363ef7a987",
};

// (author, text, minutesAgo) — a believable back-and-forth incl. @mentions.
const THREAD = [
  ["noah", "Okay the light here is unreal 🔥 what time did you shoot this?", 320],
  ["alice", "@noah right at golden hour, maybe 7:10pm. The sky did all the work 😅", 305],
  ["zara", "the COLORS. need this on my feed immediately", 300],
  ["rowan", "Nature really said *here, have a masterpiece*", 280],
  ["marco", "Adding this spot to the route. Where exactly is this?", 240],
  ["alice", "@marco it's the ridge above the old town — 20 min hike, worth every step", 232],
  ["kenji", "great, now I'm hungry for a sunset dinner with this view 🍷", 180],
  ["lena", "this is my new wallpaper, hope that's ok 😌", 95],
  ["tariq", "imagine paragliding off that ridge at this hour 🪂", 40],
];

async function main() {
  const { count } = await db
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", POST);
  if ((count ?? 0) > 0) {
    console.log(`= post already has ${count} comments, skipping`);
    return;
  }
  const now = Date.now();
  const rows = THREAD.map(([who, text, mins]) => ({
    content: text,
    owner_id: who === "alice" ? ALICE : U[who],
    post_id: POST,
    created_at: new Date(now - mins * 60_000).toISOString(),
  }));
  const { error } = await db.from("comments").insert(rows);
  if (error) throw error;
  await db.from("posts").update({ comment_count: rows.length }).eq("id", POST);
  console.log(`+ seeded ${rows.length} comments on Alice's "Golden hour" post`);
}

main().catch((e) => {
  console.error("Failed:", e?.message || e, e?.details || "");
  process.exit(1);
});
