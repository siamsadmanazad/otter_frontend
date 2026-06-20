/**
 * TripOtter demo seed — idempotent. Safe to run repeatedly (skip-if-exists everywhere).
 *
 * Usage (reads service-role creds from env; NEVER hardcode keys):
 *   SUPABASE_URL=... SERVICE_ROLE_KEY=... node scripts/seed.mjs
 *   # local stack:  SUPABASE_URL=http://127.0.0.1:54321 SERVICE_ROLE_KEY=<local service_role> node scripts/seed.mjs
 *   # hosted:       reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local if present
 *   # purge demo:   node scripts/seed.mjs --purge   (deletes only the deterministic demo users + cascades)
 *
 * Demo login for all users: password below. Emails are otter.demo+<name>@tripotter.app.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- credentials -----------------------------------------------------------
function loadEnvLocal() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    const out = {};
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}
const envFile = loadEnvLocal();
const SUPABASE_URL =
  process.env.SUPABASE_URL || envFile.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL / SERVICE_ROLE_KEY (env or .env.local). Aborting."
  );
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "OtterDemo!2026";
const PURGE = process.argv.includes("--purge");

const USERS = [
  { key: "alice", username: "otter_alice", fullName: "Alice Rivers", bio: "Backpacker chasing waterfalls.", location: "Lisbon, Portugal" },
  { key: "ben", username: "otter_ben", fullName: "Ben Cho", bio: "Cyclist + street-food hunter.", location: "Seoul, South Korea" },
  { key: "cara", username: "otter_cara", fullName: "Cara Mensah", bio: "Solo traveler, 30 countries.", location: "Accra, Ghana" },
  { key: "diego", username: "otter_diego", fullName: "Diego Santos", bio: "Mountains over malls.", location: "Quito, Ecuador" },
  { key: "emi", username: "otter_emi", fullName: "Emi Tanaka", bio: "Slow travel + journaling.", location: "Kyoto, Japan" },
  { key: "farah", username: "otter_farah", fullName: "Farah Khan", bio: "Desert roads & long drives.", location: "Dubai, UAE" },
  { key: "george", username: "otter_george", fullName: "George Hill", bio: "Van life, full time.", location: "Queenstown, NZ" },
  { key: "hana", username: "otter_hana", fullName: "Hana Novak", bio: "City breaks & cafés.", location: "Prague, Czechia" },
];
const email = (u) => `otter.demo+${u.key}@tripotter.app`;
const avatar = (id) => `https://i.pravatar.cc/200?u=${id}`;

async function findUserByEmail(addr) {
  // listUsers is paginated; demo set is tiny so scan a few pages.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === addr);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function purge() {
  console.log("Purging demo users…");
  let n = 0;
  for (const u of USERS) {
    const existing = await findUserByEmail(email(u));
    if (existing) {
      await db.auth.admin.deleteUser(existing.id);
      n++;
    }
  }
  console.log(`Deleted ${n} demo users (their data cascaded).`);
}

async function ensureUsers() {
  const ids = {};
  for (const u of USERS) {
    let existing = await findUserByEmail(email(u));
    if (!existing) {
      const { data, error } = await db.auth.admin.createUser({
        email: email(u),
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName, name: u.fullName, username: u.username },
      });
      if (error) throw error;
      existing = data.user;
      console.log(`+ created ${u.username}`);
    }
    ids[u.key] = existing.id;
  }
  // Enrich profiles deterministically (safe to repeat).
  for (const u of USERS) {
    await db
      .from("profiles")
      .update({
        full_name: u.fullName,
        username: u.username,
        bio: u.bio,
        location: u.location,
        profile_image: avatar(ids[u.key]),
      })
      .eq("id", ids[u.key]);
  }
  return ids;
}

async function ensureFollows(ids) {
  const keys = USERS.map((u) => u.key);
  const rows = [];
  keys.forEach((k, i) => {
    // each user follows the next 3 (wrap-around) -> a connected graph
    for (let d = 1; d <= 3; d++) {
      const t = keys[(i + d) % keys.length];
      rows.push({ follower_id: ids[k], following_id: ids[t] });
    }
  });
  await db.from("follows").upsert(rows, {
    onConflict: "follower_id,following_id",
    ignoreDuplicates: true,
  });
  console.log(`~ follow graph ensured (${rows.length} edges)`);
}

async function ensurePosts(ids) {
  const ownerIds = Object.values(ids);
  const { count } = await db
    .from("posts")
    .select("id", { count: "exact", head: true })
    .in("owner_id", ownerIds);
  if ((count ?? 0) > 0) {
    console.log("= posts already seeded, skipping");
    return;
  }
  const captions = [
    "Sunrise over the old town. #travel #wander",
    "Best noodles of my life. #food",
    "Found a hidden beach today 🏖️ #beach",
    "Trail done, knees destroyed. Worth it. #hiking",
    "Coffee + maps = perfect morning. #citybreak",
    "Night market chaos, in the best way. #food #night",
    "Crossed another border by bus. #roadtrip",
    "Rainy day, museum day. #culture",
  ];
  const journals = [
    {
      caption:
        "Three days in the mountains\n\nWe started before dawn, the air sharp and clean. By noon the valley opened up and every switchback paid us back twice. Slept under more stars than I could count. #journey",
    },
    {
      caption:
        "A slow week in Kyoto\n\nNo plans, just temples, tea, and long walks by the river. The kind of trip that resets you. Wrote every evening. #journal #slowtravel",
    },
  ];
  const rows = [];
  const keys = USERS.map((u) => u.key);
  captions.forEach((c, i) => {
    rows.push({
      owner_id: ids[keys[i % keys.length]],
      caption: c,
      images: [],
      post_type: "POST",
    });
  });
  journals.forEach((j, i) => {
    rows.push({
      owner_id: ids[keys[(i + 4) % keys.length]],
      caption: j.caption,
      images: [],
      post_type: "JOURNAL",
    });
  });
  const { error } = await db.from("posts").insert(rows);
  if (error) throw error;
  console.log(`+ ${rows.length} posts (incl. ${journals.length} journals)`);
}

async function ensureTribes(ids) {
  const defs = [
    { name: "Solo Travelers", description: "Tips & meetups for going it alone.", category: "COMMUNITY", creator: "cara" },
    { name: "Mountain Lovers", description: "Peaks, trails, and altitude.", category: "JOURNEY", creator: "diego" },
    { name: "Street Food Club", description: "The best cheap eats worldwide.", category: "FOOD", creator: "ben" },
  ];
  for (const t of defs) {
    let { data: existing } = await db
      .from("tribes")
      .select("id")
      .eq("name", t.name)
      .maybeSingle();
    let tribeId = existing?.id;
    if (!tribeId) {
      const { data, error } = await db
        .from("tribes")
        .insert({
          name: t.name,
          description: t.description,
          category: t.category,
          created_by: ids[t.creator],
          tags: ["demo"],
        })
        .select("id")
        .single();
      if (error) throw error;
      tribeId = data.id;
      console.log(`+ tribe "${t.name}"`);
    }
    // members: creator + 3 others
    const memberKeys = [t.creator, ...USERS.map((u) => u.key).filter((k) => k !== t.creator).slice(0, 3)];
    await db.from("tribe_members").upsert(
      memberKeys.map((k) => ({ tribe_id: tribeId, user_id: ids[k] })),
      { onConflict: "tribe_id,user_id", ignoreDuplicates: true }
    );
    // one tribe post if none yet
    const { count } = await db
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("tribe_id", tribeId);
    if ((count ?? 0) === 0) {
      await db.from("posts").insert({
        owner_id: ids[t.creator],
        caption: `Welcome to ${t.name}! Drop your best tip below. #${t.category.toLowerCase()}`,
        images: [],
        post_type: "POST",
        tribe_id: tribeId,
      });
    }
  }
  console.log("~ tribes + members ensured");
}

async function ensureConversation(ids) {
  // a DIRECT conversation between alice and ben
  const a = ids.alice,
    b = ids.ben;
  const { data: aConvs } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", a);
  const aSet = new Set((aConvs ?? []).map((r) => r.conversation_id));
  const { data: bConvs } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", b);
  const shared = (bConvs ?? [])
    .map((r) => r.conversation_id)
    .filter((id) => aSet.has(id));
  let convId = null;
  if (shared.length) {
    const { data } = await db
      .from("conversations")
      .select("id")
      .in("id", shared)
      .eq("type", "DIRECT")
      .maybeSingle();
    convId = data?.id ?? null;
  }
  if (convId) {
    console.log("= demo conversation already exists, skipping");
    return;
  }
  const { data: conv } = await db
    .from("conversations")
    .insert({ type: "DIRECT", created_by: a })
    .select("id")
    .single();
  await db.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: a },
    { conversation_id: conv.id, user_id: b },
  ]);
  const msgs = [
    { sender_id: a, content: "Hey Ben! Loved your Seoul food posts 🍜" },
    { sender_id: b, content: "Thanks Alice! You have to try the night markets." },
    { sender_id: a, content: "Adding it to my list. Any tribe you'd recommend?" },
    { sender_id: b, content: "Join Street Food Club — it's great." },
  ];
  let last = null;
  for (const m of msgs) {
    const { data } = await db
      .from("messages")
      .insert({ conversation_id: conv.id, ...m })
      .select("id, created_at")
      .single();
    last = data;
  }
  if (last)
    await db
      .from("conversations")
      .update({ last_message_id: last.id, last_message_at: last.created_at })
      .eq("id", conv.id);
  console.log(`+ demo conversation (${msgs.length} messages)`);
}

async function ensureNotifications(ids) {
  // gate: only seed if alice has none
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", ids.alice);
  if ((count ?? 0) > 0) {
    console.log("= notifications already seeded, skipping");
    return;
  }
  await db.rpc("create_notification", {
    p_recipient_id: ids.alice,
    p_actor_id: ids.ben,
    p_type: "FOLLOW",
    p_target_type: "USER",
    p_target_id: ids.ben,
    p_message: "started following you",
  });
  await db.rpc("create_notification", {
    p_recipient_id: ids.alice,
    p_actor_id: ids.cara,
    p_type: "FOLLOW",
    p_target_type: "USER",
    p_target_id: ids.cara,
    p_message: "started following you",
  });
  console.log("+ seeded a couple notifications for alice");
}

async function main() {
  console.log(`Seeding ${SUPABASE_URL} …`);
  if (PURGE) {
    await purge();
    return;
  }
  const ids = await ensureUsers();
  await ensureFollows(ids);
  await ensurePosts(ids);
  await ensureTribes(ids);
  await ensureConversation(ids);
  await ensureNotifications(ids);
  console.log("\n✅ Seed complete.");
  console.log("Demo login — password for ALL demo users:", PASSWORD);
  console.log("Emails: otter.demo+{alice,ben,cara,diego,emi,farah,george,hana}@tripotter.app");
}

main().catch((e) => {
  console.error("Seed failed:", e?.message || e);
  process.exit(1);
});
