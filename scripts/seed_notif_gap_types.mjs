/**
 * Seed the 7 notification types Alice's account has zero rows of, so the
 * sunset-palette notification redesign (otter_flutter/docs/
 * notification_sunset_palette.md) can be visually verified against every
 * family, not just the 7 types that already existed in the demo data.
 * Idempotent per type: skips any type that already has a row for Alice,
 * so re-running is safe. Run with Node 22+.
 *
 *   ~/.nvm/versions/node/v22.22.2/bin/node scripts/seed_notif_gap_types.mjs
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

const ALICE = "3036b1b0-b889-43e9-945d-b3700beb96b5"; // otter_alice, the demo login account

const U = {
  marco: "cf787d5d-4d30-4e3f-9a5e-9ab04bbf7ce8", // atlas_marco
  zara: "0f3b282e-06b6-4276-85e1-f50221c8468f",
  rowan: "9b35c66e-8b96-483b-aa52-dc80d0a68999",
  kenji: "57f4eb16-2b44-47ea-b2ee-83257aec57c5",
  tariq: "ad6abac5-2f3e-4a9e-8b8a-92351b9c79d3",
  lena: "37c3f796-6952-4ef7-8e60-ca793fbd033f",
};

// Real rows Alice owns/relates to — target_id isn't FK-constrained on
// `notifications`, but fabricated ids would 404 on tap, so use real ones.
const TARGET = {
  alicePost: "ac8aa55e-d955-49e2-8eba-9518fa476c6c", // "Sunrise over the old town..."
  aroundTheWorldTribe: "3883dfed-6e2f-4d12-8840-0811cab61351",
  goldenHourTribe: "b66f8c81-1adf-42a8-9945-dda0d1c54cd0",
  aliceUbudTrip: "2abcdf85-3f18-4ca1-b824-20db0be31af0", // Alice's own trip -> she's the owner, a request makes sense
  marcoJapanTrip: "3f12972b-61d5-40f4-a20b-eb87a4d27602", // Marco's trip -> Alice being accepted makes sense
  aliceComment1: "25f1d9e3-1038-4508-877e-0b61f409fb4b", // Alice's comment, for a reply
  aliceComment2: "c6137be4-2755-4bd2-be17-ec4f7b5538dc", // Alice's comment, for a like
};

const ROWS = [
  {
    type: "MENTION",
    actor: U.marco,
    target_type: "POST",
    target_id: TARGET.alicePost,
    message: "mentioned you in a comment",
  },
  {
    type: "TRIBE_JOIN",
    actor: U.zara,
    target_type: "TRIBE",
    target_id: TARGET.aroundTheWorldTribe,
    message: "joined Around the World",
  },
  {
    type: "TRIBE_POST",
    actor: U.rowan,
    target_type: "TRIBE",
    target_id: TARGET.goldenHourTribe,
    message: "posted in Golden Hour",
  },
  {
    type: "TRIP_REQUEST",
    actor: U.kenji,
    target_type: "TRIP",
    target_id: TARGET.aliceUbudTrip,
    message: "asked to join your Ubud trip",
  },
  {
    type: "TRIP_ACCEPTED",
    actor: U.marco,
    target_type: "TRIP",
    target_id: TARGET.marcoJapanTrip,
    message: "accepted you on the Japan Rail trip",
  },
  {
    type: "COMMENT_REPLY",
    actor: U.tariq,
    target_type: "COMMENT",
    target_id: TARGET.aliceComment1,
    message: "replied to your comment",
  },
  {
    type: "COMMENT_LIKE",
    actor: U.lena,
    target_type: "COMMENT",
    target_id: TARGET.aliceComment2,
    message: "liked your comment",
  },
];

async function main() {
  for (const row of ROWS) {
    const { count, error: countErr } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", ALICE)
      .eq("type", row.type);
    if (countErr) {
      console.error(`✗ ${row.type}: count check failed —`, countErr.message);
      continue;
    }
    if ((count ?? 0) > 0) {
      console.log(`- ${row.type}: already has ${count} row(s), skipping`);
      continue;
    }

    const { data, error } = await db.rpc("create_notification", {
      p_recipient_id: ALICE,
      p_actor_id: row.actor,
      p_type: row.type,
      p_target_type: row.target_type,
      p_target_id: row.target_id,
      p_message: row.message,
    });
    if (error) {
      console.error(`✗ ${row.type}: rpc failed —`, error.message);
    } else {
      console.log(`✓ ${row.type}: created notification ${data}`);
    }
  }
}

main().then(() => process.exit(0));
