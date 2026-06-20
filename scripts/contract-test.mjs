/**
 * Phase D3 — route contract smoke test.
 *
 * Calls each route group as a client and asserts the `{ message, status, data }` envelope
 * + `id` (never `_id`) + the irregular request bodies. Run against a LIVE dev server with a
 * seeded account (see scripts/seed.mjs). Requires Node >= 22 (native fetch/WebSocket).
 *
 *   API_BASE_URL=http://localhost:3000 \
 *   TEST_EMAIL=otter.demo+alice@tripotter.app TEST_PASSWORD=OtterDemo!2026 \
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/contract-test.mjs
 *
 * Auth: signs in via Supabase to get an access token, then calls routes with
 * `Authorization: Bearer`. Read-only except a like-toggle it reverts.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
function envLocal() {
  try {
    const t = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    const o = {};
    for (const l of t.split("\n")) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return o;
  } catch {
    return {};
  }
}
const E = envLocal();
const API = process.env.API_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.SUPABASE_URL || E.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_EMAIL || "otter.demo+alice@tripotter.app";
const PASSWORD = process.env.TEST_PASSWORD || "OtterDemo!2026";

let pass = 0,
  fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  PASS: ${name}`);
  } else {
    fail++;
    console.error(`  FAIL: ${name}`);
  }
}
function isEnvelope(j) {
  return j && typeof j === "object" && "message" in j && "status" in j && "data" in j;
}
function noUnderscoreId(obj) {
  return !JSON.stringify(obj ?? {}).includes('"_id"');
}

async function main() {
  if (!SUPABASE_URL || !ANON) {
    console.error("Missing SUPABASE_URL / ANON key.");
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false },
  });
  const { data: auth, error } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) {
    console.error("Sign-in failed:", error.message);
    process.exit(1);
  }
  const token = auth.session.accessToken ?? auth.session.access_token;
  const uid = auth.user.id;
  const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const get = (p) => fetch(`${API}${p}`, { headers: H }).then((r) => r.json());
  const post = (p, b) =>
    fetch(`${API}${p}`, { method: "POST", headers: H, body: JSON.stringify(b) }).then((r) => r.json());

  console.log("health");
  check("health envelope", isEnvelope(await get("/api/health")));

  console.log("users");
  const u = await get(`/api/users?id=${uid}`);
  check("users envelope", isEnvelope(u));
  check("users has id (not _id)", u.data?.id === uid && noUnderscoreId(u));

  console.log("feed");
  const feed = await get(`/api/feed?id=${uid}&page=1&limit=5`);
  check("feed envelope", isEnvelope(feed));
  check("feed data is array", Array.isArray(feed.data));
  check("feed posts have id (not _id)", noUnderscoreId(feed.data));

  console.log("notifications");
  const n = await get("/api/notifications?page=1&limit=5");
  check("notifications envelope", isEnvelope(n));
  check("notifications no _id", noUnderscoreId(n.data));

  console.log("tribe browse");
  const t = await get("/api/tribe?page=1&limit=5");
  check("tribe envelope", isEnvelope(t));

  console.log("companion (heuristic GET)");
  const c = await get(`/api/companion?userId=${uid}&page=1&limit=3`);
  check("companion envelope", isEnvelope(c));

  console.log("chat conversations");
  const cv = await get("/api/chat/conversations");
  check("chat conversations envelope", isEnvelope(cv));

  // Irregular body: reaction uses { post }. Toggle on a feed post, then revert.
  const firstPost = Array.isArray(feed.data) ? feed.data[0] : null;
  if (firstPost?.id) {
    console.log("reaction (irregular body { post })");
    const r1 = await post("/api/reaction", { post: firstPost.id });
    check("reaction envelope + isLiked", isEnvelope(r1) && "isLiked" in (r1.data ?? {}));
    await post("/api/reaction", { post: firstPost.id }); // revert toggle
  } else {
    console.log("reaction skipped (no feed post)");
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Contract test crashed:", e?.message || e);
  process.exit(1);
});
