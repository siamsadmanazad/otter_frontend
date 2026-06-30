/**
 * TripOtter "10 genre personas" demo seed — high-end archetypes that exercise
 * EVERY feature: feed, journals, tribes + roles, the per-tribe Trips/Companions
 * board, DMs (incl. requests + archived), notifications, follows, likes,
 * comments, saved posts.
 *
 * Idempotent: safe to re-run (skip-if-exists everywhere). Keeps Alice
 * (the a@a.co fast-login account) intact and PURGES the 7 deprecated demo
 * extras (ben/cara/diego/emi/farah/george/hana) + the junk test tribe.
 *
 * Usage:
 *   node scripts/seed_personas.mjs           # build/refresh on hosted (.env.local)
 *   node scripts/seed_personas.mjs --purge   # remove ONLY the 10 personas + cascades
 *
 * Login for all personas: password OtterDemo!2026, email otter.demo+<key>@tripotter.app
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
const SERVICE_ROLE_KEY =
  process.env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SERVICE_ROLE_KEY (env or .env.local).");
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "OtterDemo!2026";
const PURGE = process.argv.includes("--purge");

// Alice — the existing a@a.co fast-login account. We reference her by id, we do
// NOT create or repoint her auth (her login email/password live outside this set).
const ALICE_ID = "3036b1b0-b889-43e9-945d-b3700beb96b5";

const DEPRECATED = ["ben", "cara", "diego", "emi", "farah", "george", "hana"];
const JUNK_TRIBES = ["H1 Retry 1782205155"];

const email = (key) => `otter.demo+${key}@tripotter.app`;
const avatar = (id) => `https://i.pravatar.cc/400?u=${id}`;
const photo = (kw, lock) =>
  `https://loremflickr.com/900/700/${encodeURIComponent(kw)}?lock=${lock}`;

// --- the roster -------------------------------------------------------------
let LOCK = 100; // deterministic loremflickr image seed
const img = (kw) => photo(kw, LOCK++);

const PERSONAS = [
  {
    key: "marco",
    username: "atlas_marco",
    fullName: "Marco Vance",
    location: "Singapore",
    bio: "🌍 73 countries and counting. Rail loops, passport flexes, slow border crossings. Ask me anything about long-haul.",
    cover: "world,map,airport",
    posts: [
      { cap: "Country #73 stamped today. The collection grows. 🛂 #travel #wander", kw: "passport,stamp" },
      { cap: "14 hours of trains, 3 countries, 1 incredible day. #railtravel", kw: "train,window,landscape" },
      { cap: "Sunrise from the rooftop in Singapore. Home base for now. #citybreak", kw: "singapore,skyline" },
    ],
    journal: {
      cap: "How I plan a round-the-world route\n\nPeople ask how I string 70+ countries together without burning out. The trick is rhythm: two fast weeks, one slow week, repeat. Anchor each leg to one overland route and let the detours find you. Never book the last night of a city — that's where the best stories live.\n\n#journey #longtravel",
    },
    tribe: {
      name: "Around the World",
      category: "LONG_TRAVEL",
      description: "For people doing the big trip. Routes, visas, overland tips.",
      rules: "1. Real routes only. 2. Share visa intel. 3. No drop-shipping spam.",
    },
    trip: {
      title: "Japan Rail 14-day loop",
      destination: "Japan",
      start: "2026-10-01",
      end: "2026-10-14",
      spots: 2,
      budget: "MID",
      style: "MIXED",
      notes: "JR Pass loop Tokyo→Kyoto→Hiroshima→Kanazawa. Looking for 2 chill travel buddies.",
      requests: [
        { key: "kenji", status: "ACCEPTED", message: "Food stops on me." },
        { key: "amara", status: "ACCEPTED", message: "I'll handle the temple routing." },
      ],
    },
  },
  {
    key: "zara",
    username: "neon_zara",
    fullName: "Zara Lux",
    location: "Ibiza, Spain",
    bio: "🎉 Festival chaser. If there's a sound system and a sunrise, I'm there. Ibiza · Tomorrowland · Tulum.",
    cover: "festival,crowd,lights",
    posts: [
      { cap: "Front row, no regrets. The drop hit different tonight. 🔊 #festival #night", kw: "concert,festival" },
      { cap: "Beach club to closing party. Ibiza never sleeps and neither do I. #ibiza", kw: "beach,party,night" },
      { cap: "Confetti in my hair for a week, worth it. #rave #neon", kw: "neon,party,lights" },
    ],
    journal: {
      cap: "Surviving festival season (a love letter)\n\nFour countries, six festivals, one very tired soul. The secret isn't stamina, it's pacing — hydrate like it's your job, find your people early, and never skip the small stages. The headliners sell the ticket, but the 4pm unknown act is what you'll talk about for years.\n\n#journal #festival",
    },
    tribe: {
      name: "Neon Nights",
      category: "COMMUNITY",
      description: "Festivals, raves, nightlife. Lineups, meetups, after-movies.",
      rules: "1. Look after each other. 2. Share lineups. 3. No gatekeeping the small stages.",
    },
    trip: {
      title: "Tomorrowland 2026 crew",
      destination: "Boom, Belgium",
      start: "2026-07-17",
      end: "2026-07-26",
      spots: 4,
      budget: "LUXURY",
      style: "MIXED",
      notes: "Have a Dreamville lodge with 2 spare beds. Looking for a fun, drama-free crew.",
      requests: [
        { key: "sam", status: "PENDING", message: "I'll bring the energy (and snacks)." },
        { key: "lena", status: "ACCEPTED", message: "In! I can drive from Lisbon." },
        { key: "marco", status: "PENDING" },
      ],
    },
  },
  {
    key: "rowan",
    username: "wild_rowan",
    fullName: "Rowan Frost",
    location: "Banff, Canada",
    bio: "🌲 Nature first. National parks, alpine lakes, wildlife at a respectful distance. Leave no trace.",
    cover: "mountain,lake,forest",
    posts: [
      { cap: "Glacier-fed and impossibly blue. Banff still gets me. #nature #hiking", kw: "lake,mountain" },
      { cap: "Spotted a moose at dawn. Kept my distance, kept the photo. 🫎 #wildlife", kw: "wildlife,forest" },
      { cap: "Trail done, knees destroyed, soul restored. #journey", kw: "hiking,trail,mountain" },
    ],
    journal: {
      cap: "On going slow in wild places\n\nThe mountains don't reward rushing. I used to chase summits like a checklist; now I sit by the lake for an hour before I climb. The wildlife shows up when you stop being loud. The best view of the trip was a marmot deciding I was furniture.\n\n#journal #nature",
    },
    tribe: {
      name: "Wild & Free",
      category: "JOURNEY",
      description: "National parks, trails, wildlife. Conservation-minded adventurers.",
      rules: "1. Leave no trace. 2. Respect wildlife distance. 3. Share trail conditions.",
    },
    trip: {
      title: "Patagonia W-Trek",
      destination: "Torres del Paine, Chile",
      start: "2026-11-05",
      end: "2026-11-14",
      spots: 3,
      budget: "MID",
      style: "ADVENTURE",
      notes: "Refugio bookings sorted. Need 3 trekkers comfortable with long days + wind.",
      requests: [
        { key: "tariq", status: "ACCEPTED", message: "Done deal. I'll carry the stove." },
        { key: "noah", status: "PENDING", message: "Can I shoot the towers at sunrise?" },
      ],
    },
  },
  {
    key: "victoria",
    username: "suite_victoria",
    fullName: "Victoria Sterling",
    location: "Dubai, UAE",
    bio: "💎 Luxury travel curator. Suites with a view, first-class seats, tables you book a year ahead.",
    cover: "luxury,hotel,resort",
    posts: [
      { cap: "Checked in. The view came with the suite. ✨ #luxury #travel", kw: "luxury,hotel,view" },
      { cap: "Turning left on the plane never gets old. #firstclass", kw: "airplane,cabin" },
      { cap: "12 courses, 3 hours, zero regrets. #finedining", kw: "fine,dining,restaurant" },
    ],
    journal: {
      cap: "What 'luxury' actually means now\n\nIt stopped being about thread count. The real luxury is time and access — the concierge who gets you the impossible table, the lounge where the layover melts away, the guide who opens the museum after hours. Spend on the moments you can't repeat, save on the ones you can.\n\n#journal #luxury",
    },
    tribe: {
      name: "First Class Only",
      category: "ABROAD",
      description: "Five-star stays, premium cabins, fine dining. Points & upgrades welcome.",
      rules: "1. Real reviews. 2. Share upgrade hacks. 3. Be gracious.",
    },
  },
  {
    key: "sam",
    username: "shoestring_sam",
    fullName: "Sam Okoye",
    location: "Bangkok, Thailand",
    bio: "🎒 $30/day and loving it. Hostels, night buses, street eats. Proof you don't need money to see the world.",
    cover: "backpack,hostel,street",
    posts: [
      { cap: "$1.20 dinner and the best pad see ew of my life. #budget #food", kw: "streetfood,thailand" },
      { cap: "Night bus chronicles: slept like a baby, woke up in a new province. #roadtrip", kw: "bus,night,road" },
      { cap: "Hostel rooftop, free sunset, new friends from 6 countries. #backpacking", kw: "hostel,sunset" },
    ],
    journal: {
      cap: "How I travel on $30 a day\n\nIt's not deprivation, it's design. Sleep in dorms, eat where the locals queue, walk more than you ride, and let buses be your hotels. The money you save buys time — and time is the whole point. Spent four months across SE Asia for less than one week of a resort.\n\n#journal #budget",
    },
    tribe: {
      name: "Shoestring",
      category: "LONG_TRAVEL",
      description: "Maximum trip, minimum budget. Hacks, dorms, cheap eats.",
      rules: "1. Share real prices. 2. No humble-bragging. 3. Tip your hostel staff.",
    },
  },
  {
    key: "kenji",
    username: "umami_kenji",
    fullName: "Kenji Mori",
    location: "Tokyo, Japan",
    bio: "🍜 Eating my way around the world. Street stalls to Michelin stars. The map is delicious.",
    cover: "ramen,food,market",
    posts: [
      { cap: "7am tuna auction, then the best sushi breakfast imaginable. #food", kw: "sushi,japan" },
      { cap: "This bowl has been simmering for 40 years. You can taste it. 🍜 #ramen", kw: "ramen,bowl" },
      { cap: "Night market crawl, 9 stalls, 1 happy stomach. #food #night", kw: "nightmarket,food" },
    ],
    journal: {
      cap: "Why I plan trips around meals\n\nMost people book the flight then find the food. I do it backwards. A city's soul is in its markets at 6am and its alleys at midnight. Learn ten food words in the local language and doors open everywhere. The best meal I ever had cost two dollars and came with a plastic stool.\n\n#journal #food",
    },
    tribe: {
      name: "Plates & Places",
      category: "FOOD",
      description: "The best eats worldwide — street stalls to fine dining.",
      rules: "1. Geotag the spot. 2. Street food counts. 3. No food snobbery.",
    },
    trip: {
      title: "Tokyo ramen crawl weekend",
      destination: "Tokyo, Japan",
      start: "2026-08-22",
      end: "2026-08-24",
      spots: 6,
      budget: "BUDGET",
      style: "RELAXED",
      notes: "8 shops in 48 hours. Stretchy pants mandatory. All levels of spice tolerance welcome.",
      requests: [
        { key: "sam", status: "ACCEPTED", message: "Ramen is my budget love language." },
        { key: "victoria", status: "PENDING", message: "Slumming it for the noodles 😄" },
      ],
    },
  },
  {
    key: "tariq",
    username: "sendit_tariq",
    fullName: "Tariq Haddad",
    location: "Queenstown, New Zealand",
    bio: "🪂 Adrenaline is the destination. Skydiving, big-wall climbing, surfing anything that breaks.",
    cover: "skydive,surf,climbing",
    posts: [
      { cap: "Stepped out at 15,000ft. The view on the way down is unreal. #adventure", kw: "skydive,sky" },
      { cap: "Dawn patrol paid off. Empty lineup, perfect sets. 🏄 #surf", kw: "surf,wave" },
      { cap: "300m of granite below me. Don't look down (look down). #climbing", kw: "climbing,rock" },
    ],
    journal: {
      cap: "Fear is a tool, not a wall\n\nEveryone thinks adrenaline junkies are fearless. We're not — we're just on good terms with fear. It sharpens you. The trick is preparation so thorough that when the moment comes, your body already knows what to do and fear just turns up the colours.\n\n#journal #adventure",
    },
    tribe: {
      name: "Send It",
      category: "JOURNEY",
      description: "Adventure & adrenaline. Skydive, surf, climb, repeat.",
      rules: "1. Safety first, always. 2. Share conditions. 3. No reckless dares.",
    },
    trip: {
      title: "Skydive + surf, Gold Coast",
      destination: "Gold Coast, Australia",
      start: "2026-09-10",
      end: "2026-09-17",
      spots: 5,
      budget: "MID",
      style: "ADVENTURE",
      notes: "Mornings in the water, afternoons in the air. Beginners welcome — we'll buddy up.",
      requests: [{ key: "zara", status: "PENDING", message: "Never jumped but I'm fearless on a dancefloor 😅" }],
    },
  },
  {
    key: "lena",
    username: "async_lena",
    fullName: "Lena Vogt",
    location: "Lisbon, Portugal",
    bio: "💻 Building from anywhere. Co-living, fast wifi, slow mornings. 9 timezones this year.",
    cover: "laptop,cafe,coworking",
    posts: [
      { cap: "Office today: a café with a castle view and surprisingly fast wifi. #nomad", kw: "cafe,laptop,city" },
      { cap: "Standup at 9, surf at 12, ship at 4. The async life works. #digitalnomad", kw: "coworking,desk" },
      { cap: "Three months in Lisbon, found my people at the co-living. #citybreak", kw: "lisbon,street" },
    ],
    journal: {
      cap: "The honest truth about working remotely abroad\n\nThe Instagram version is laptops on beaches (terrible, by the way — glare and sand). The real version is finding routine in chaos: a reliable café, a gym, one local friend. Productivity isn't about location, it's about boundaries. The freedom only works if you're disciplined enough to deserve it.\n\n#journal #nomad",
    },
    tribe: {
      name: "Work From Anywhere",
      category: "COMMUNITY",
      description: "Digital nomads. Co-living, wifi intel, visa runs, meetups.",
      rules: "1. Share wifi speeds. 2. No MLM 'opportunities'. 3. Help newcomers.",
    },
  },
  {
    key: "amara",
    username: "oldsoul_amara",
    fullName: "Amara Diallo",
    location: "Marrakech, Morocco",
    bio: "🏛️ History is my map. Old cities, museums after hours, festivals that go back centuries.",
    cover: "ancient,architecture,old,city",
    posts: [
      { cap: "Got lost in the medina on purpose. 900 years of stories in these walls. #culture", kw: "medina,morocco" },
      { cap: "Empty museum, golden light, a 2,000-year-old face looking back. #history", kw: "museum,ancient" },
      { cap: "Festival drums until midnight. Some traditions you feel in your chest. #culture", kw: "festival,culture" },
    ],
    journal: {
      cap: "Reading a city like a book\n\nEvery old city has a grammar — where the markets sit, why the mosque faces that way, which gate the traders used. Learn a little history before you arrive and the streets start speaking. I travel for the layers: the Roman road under the medieval wall under the modern café. Time, stacked.\n\n#journal #culture",
    },
    tribe: {
      name: "Old Souls",
      category: "LOCATION",
      description: "Heritage, history, culture. Ruins, museums, living traditions.",
      rules: "1. Respect sacred sites. 2. Cite your history. 3. Support local guides.",
    },
  },
  {
    key: "noah",
    username: "goldenhour_noah",
    fullName: "Noah Kim",
    location: "Reykjavik, Iceland",
    bio: "📸 Chasing light. Landscapes, drone work, aurora at 2am. Prints in bio (eventually).",
    cover: "aurora,landscape,iceland",
    posts: [
      { cap: "Stood in the cold for 4 hours. She finally danced. 💚 #aurora #photography", kw: "aurora,iceland" },
      { cap: "Drone up over the black sand. Scale is everything. #landscape", kw: "drone,coast" },
      { cap: "Golden hour lasted 40 minutes this far north. Shot every second. #goldenhour", kw: "sunset,mountain" },
    ],
    journal: {
      cap: "Light is the only subject\n\nPeople ask what camera I use. Wrong question. The gear is nothing; the light is everything. I'll wait days for a sky. I scout in the dull afternoon so I'm ready when the world turns gold for twenty minutes. Photography taught me patience, and patience taught me to actually see.\n\n#journal #photography",
    },
    tribe: {
      name: "Golden Hour",
      category: "LOCATION",
      description: "Travel photography. Landscapes, drones, light, gear talk.",
      rules: "1. Credit creators. 2. Share settings. 3. No stolen shots.",
    },
  },
];

const byKey = Object.fromEntries(PERSONAS.map((p) => [p.key, p]));

// --- helpers ----------------------------------------------------------------
async function findUserByEmail(addr) {
  for (let page = 1; page <= 15; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === addr);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function purgePersonas() {
  let n = 0;
  for (const p of PERSONAS) {
    const u = await findUserByEmail(email(p.key));
    if (u) {
      await db.auth.admin.deleteUser(u.id);
      n++;
    }
  }
  console.log(`Purged ${n} personas (data cascaded).`);
}

async function purgeDeprecated() {
  let n = 0;
  for (const key of DEPRECATED) {
    const u = await findUserByEmail(email(key));
    if (u) {
      await db.auth.admin.deleteUser(u.id);
      n++;
    }
  }
  for (const name of JUNK_TRIBES) {
    await db.from("tribes").delete().eq("name", name);
  }
  console.log(`Cleanup: removed ${n} deprecated demo users + junk tribes.`);
}

async function ensureUsers() {
  const ids = { alice: ALICE_ID };
  for (const p of PERSONAS) {
    let u = await findUserByEmail(email(p.key));
    if (!u) {
      const { data, error } = await db.auth.admin.createUser({
        email: email(p.key),
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: p.fullName, name: p.fullName, username: p.username },
      });
      if (error) throw error;
      u = data.user;
      console.log(`+ created @${p.username}`);
    }
    ids[p.key] = u.id;
  }
  for (const p of PERSONAS) {
    await db
      .from("profiles")
      .update({
        full_name: p.fullName,
        username: p.username,
        bio: p.bio,
        location: p.location,
        profile_image: avatar(ids[p.key]),
        cover_image: img(p.cover),
      })
      .eq("id", ids[p.key]);
  }
  console.log(`~ ${PERSONAS.length} persona profiles enriched`);
  return ids;
}

async function ensureFollows(ids) {
  const keys = PERSONAS.map((p) => p.key);
  const rows = [];
  // a connected graph: each persona follows the next 4 (wrap-around)
  keys.forEach((k, i) => {
    for (let d = 1; d <= 4; d++) {
      rows.push({ follower_id: ids[k], following_id: ids[keys[(i + d) % keys.length]] });
    }
  });
  // everyone follows Alice; Alice follows half the roster
  keys.forEach((k) => rows.push({ follower_id: ids[k], following_id: ALICE_ID }));
  keys.slice(0, 5).forEach((k) => rows.push({ follower_id: ALICE_ID, following_id: ids[k] }));
  await db.from("follows").upsert(rows, {
    onConflict: "follower_id,following_id",
    ignoreDuplicates: true,
  });
  console.log(`~ follow graph ensured (${rows.length} edges)`);
}

async function ensurePosts(ids) {
  // gate on any persona-owned post
  const ownerIds = PERSONAS.map((p) => ids[p.key]);
  const { count } = await db
    .from("posts")
    .select("id", { count: "exact", head: true })
    .in("owner_id", ownerIds)
    .is("tribe_id", null);
  if ((count ?? 0) > 0) {
    console.log("= persona posts already seeded, skipping");
    return await collectPostIds(ids);
  }
  const rows = [];
  for (const p of PERSONAS) {
    for (const post of p.posts) {
      rows.push({ owner_id: ids[p.key], caption: post.cap, images: [img(post.kw)], post_type: "POST" });
    }
    rows.push({ owner_id: ids[p.key], caption: p.journal.cap, images: [img(p.cover)], post_type: "JOURNAL" });
  }
  const { error } = await db.from("posts").insert(rows);
  if (error) throw error;
  console.log(`+ ${rows.length} persona posts (incl. ${PERSONAS.length} journals)`);
  return await collectPostIds(ids);
}

async function collectPostIds(ids) {
  // map owner_key -> [postId,...] for feed posts (no tribe)
  const map = {};
  for (const p of PERSONAS) {
    const { data } = await db
      .from("posts")
      .select("id")
      .eq("owner_id", ids[p.key])
      .is("tribe_id", null)
      .order("created_at", { ascending: true });
    map[p.key] = (data ?? []).map((r) => r.id);
  }
  return map;
}

async function ensureEngagement(ids, postsByKey) {
  // likes + comments from other personas on each persona's first post
  const keys = PERSONAS.map((p) => p.key);
  const likeRows = [];
  const commentRows = [];
  const tally = {}; // postId -> {likes, comments}
  const comments = [
    "This is unreal 🔥",
    "Adding this to my list right now.",
    "Okay this is the content I'm here for.",
    "Saving this for my next trip!",
    "Stunning. How was the crowd?",
  ];
  keys.forEach((k, i) => {
    const myPosts = postsByKey[k] || [];
    if (!myPosts.length) return;
    const target = myPosts[0];
    tally[target] = { likes: 0, comments: 0 };
    // 3 likers (other personas) + Alice
    const likers = [keys[(i + 1) % keys.length], keys[(i + 2) % keys.length], keys[(i + 3) % keys.length]];
    likers.forEach((lk) => {
      likeRows.push({ user_id: ids[lk], post_id: target });
      tally[target].likes++;
    });
    likeRows.push({ user_id: ALICE_ID, post_id: target });
    tally[target].likes++;
    // 1 comment
    commentRows.push({ owner_id: ids[keys[(i + 2) % keys.length]], post_id: target, content: comments[i % comments.length] });
    tally[target].comments++;
  });
  if (likeRows.length) {
    await db.from("likes").upsert(likeRows, { onConflict: "user_id,post_id", ignoreDuplicates: true });
  }
  if (commentRows.length) {
    await db.from("comments").insert(commentRows);
  }
  // sync denormalized counts (RPCs/routes normally do this; we set directly)
  for (const [postId, t] of Object.entries(tally)) {
    await db.from("posts").update({ like_count: t.likes, comment_count: t.comments }).eq("id", postId);
  }
  console.log(`~ engagement: ${likeRows.length} likes, ${commentRows.length} comments`);
}

async function ensureTribesAndTrips(ids) {
  for (const p of PERSONAS) {
    const t = p.tribe;
    let { data: existing } = await db.from("tribes").select("id").eq("name", t.name).maybeSingle();
    let tribeId = existing?.id;
    if (!tribeId) {
      const { data, error } = await db
        .from("tribes")
        .insert({
          name: t.name,
          description: t.description,
          category: t.category,
          rules: t.rules,
          created_by: ids[p.key],
          tags: ["demo", p.key],
        })
        .select("id")
        .single();
      if (error) throw error;
      tribeId = data.id;
      console.log(`+ tribe "${t.name}"`);
    }
    // members: founder + a themed handful; promote one to MODERATOR
    const others = PERSONAS.map((x) => x.key).filter((k) => k !== p.key);
    const memberKeys = [p.key, ...others.slice(0, 4)];
    const memberRows = memberKeys.map((k, idx) => ({
      tribe_id: tribeId,
      user_id: ids[k],
      role: k === p.key ? "FOUNDER" : idx === 1 ? "MODERATOR" : "MEMBER",
    }));
    // Alice joins the first three tribes as a plain member
    if (["Around the World", "Neon Nights", "Plates & Places"].includes(t.name)) {
      memberRows.push({ tribe_id: tribeId, user_id: ALICE_ID, role: "MEMBER" });
    }
    await db.from("tribe_members").upsert(memberRows, {
      onConflict: "tribe_id,user_id",
      ignoreDuplicates: true,
    });
    // welcome post if none
    const { count } = await db.from("posts").select("id", { count: "exact", head: true }).eq("tribe_id", tribeId);
    if ((count ?? 0) === 0) {
      await db.from("posts").insert({
        owner_id: ids[p.key],
        caption: `Welcome to ${t.name}! ${t.description} Drop an intro 👇`,
        images: [img(p.cover)],
        post_type: "POST",
        tribe_id: tribeId,
      });
    }
    // trip (companions board) if this persona has one
    if (t && p.trip) {
      await ensureTrip(ids, tribeId, p);
    }
  }
  console.log("~ tribes, members, roles + welcome posts ensured");
}

async function ensureTrip(ids, tribeId, p) {
  const tr = p.trip;
  let { data: existing } = await db
    .from("tribe_trips")
    .select("id")
    .eq("tribe_id", tribeId)
    .eq("title", tr.title)
    .maybeSingle();
  let tripId = existing?.id;
  if (!tripId) {
    const { data, error } = await db
      .from("tribe_trips")
      .insert({
        tribe_id: tribeId,
        owner_id: ids[p.key],
        title: tr.title,
        destination: tr.destination,
        trip_start: tr.start,
        trip_end: tr.end,
        spots: tr.spots,
        budget: tr.budget,
        travel_style: tr.style,
        notes: tr.notes,
      })
      .select("id")
      .single();
    if (error) throw error;
    tripId = data.id;
    console.log(`  + trip "${tr.title}"`);
  }
  // join requests (the accepted_count + OPEN/FULL trigger reacts to these)
  for (const r of tr.requests || []) {
    await db.from("tribe_trip_requests").upsert(
      { trip_id: tripId, user_id: ids[r.key], status: r.status, message: r.message ?? null },
      { onConflict: "trip_id,user_id", ignoreDuplicates: false }
    );
  }
}

async function ensureChats(ids) {
  // (creatorKey, otherKey, archivedByOther?, requestForOther?) + messages
  const threads = [
    { a: "marco", b: "lena", msgs: ["Lena! Saw you're in Lisbon — co-living tips?", "Yes! I'll send you my spot, fast wifi + rooftop.", "Perfect, might base there next month."] },
    { a: "alice", b: "marco", msgs: ["Marco your rail loop posts are goals 🚆", "Thanks Alice! Happy to share the route.", "Yes please!"] },
    { a: "zara", b: "victoria", request: true, msgs: ["Hey! Saw you in First Class Only — fancy Tomorrowland?", "Ha! Not my usual scene but tempting…"] },
    { a: "sam", b: "kenji", archived: true, msgs: ["That ramen crawl looks unreal, count me in", "Booked you a spot 🍜", "Legend"] },
  ];
  for (const th of threads) {
    const aId = th.a === "alice" ? ALICE_ID : ids[th.a];
    const bId = th.b === "alice" ? ALICE_ID : ids[th.b];
    // existing shared DIRECT?
    const { data: aP } = await db.from("conversation_participants").select("conversation_id").eq("user_id", aId);
    const aSet = new Set((aP ?? []).map((r) => r.conversation_id));
    const { data: bP } = await db.from("conversation_participants").select("conversation_id").eq("user_id", bId);
    const shared = (bP ?? []).map((r) => r.conversation_id).filter((id) => aSet.has(id));
    if (shared.length) {
      const { data } = await db.from("conversations").select("id").in("id", shared).eq("type", "DIRECT").maybeSingle();
      if (data?.id) continue; // already there
    }
    const { data: conv } = await db.from("conversations").insert({ type: "DIRECT", created_by: aId }).select("id").single();
    await db.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: aId },
      { conversation_id: conv.id, user_id: bId },
    ]);
    let last = null;
    for (let i = 0; i < th.msgs.length; i++) {
      const sender = i % 2 === 0 ? aId : bId;
      const { data } = await db
        .from("messages")
        .insert({ conversation_id: conv.id, sender_id: sender, content: th.msgs[i] })
        .select("id, created_at")
        .single();
      last = data;
    }
    if (last) {
      await db.from("conversations").update({ last_message_id: last.id, last_message_at: last.created_at }).eq("id", conv.id);
    }
    // force the recipient's inbox state deterministically
    if (th.request) {
      await db.from("conversation_participants").update({ accepted: false }).eq("conversation_id", conv.id).eq("user_id", bId);
    }
    if (th.archived) {
      await db.from("conversation_participants").update({ archived: true }).eq("conversation_id", conv.id).eq("user_id", bId);
    }
  }
  console.log(`~ ${threads.length} DM threads ensured (incl. 1 request + 1 archived)`);
}

async function ensureNotifications(ids) {
  const { count } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", ALICE_ID)
    .gte("created_at", "2026-06-30");
  if ((count ?? 0) > 0) {
    console.log("= persona notifications already seeded, skipping");
    return;
  }
  const n = [
    { actor: "marco", type: "FOLLOW", target: "USER", msg: "started following you" },
    { actor: "zara", type: "LIKE", target: "POST", msg: "liked your post" },
    { actor: "kenji", type: "COMMENT", target: "POST", msg: "commented: 'where is this?!'" },
    { actor: "rowan", type: "FOLLOW", target: "USER", msg: "started following you" },
  ];
  for (const x of n) {
    await db.rpc("create_notification", {
      p_recipient_id: ALICE_ID,
      p_actor_id: ids[x.actor],
      p_type: x.type,
      p_target_type: x.target,
      p_target_id: ids[x.actor],
      p_message: x.msg,
    });
  }
  console.log(`+ ${n.length} notifications for Alice`);
}

async function ensureSaved(ids, postsByKey) {
  // Alice saves a few standout posts → exercises the Saved tab
  const picks = ["noah", "victoria", "kenji", "rowan"]
    .map((k) => (postsByKey[k] || [])[0])
    .filter(Boolean)
    .map((postId) => ({ user_id: ALICE_ID, post_id: postId }));
  if (picks.length) {
    await db.from("saved_posts").upsert(picks, { onConflict: "user_id,post_id", ignoreDuplicates: true });
  }
  console.log(`~ ${picks.length} saved posts for Alice`);
}

async function main() {
  console.log(`Seeding personas → ${SUPABASE_URL}`);
  if (PURGE) {
    await purgePersonas();
    return;
  }
  await purgeDeprecated();
  const ids = await ensureUsers();
  await ensureFollows(ids);
  const postsByKey = await ensurePosts(ids);
  await ensureEngagement(ids, postsByKey);
  await ensureTribesAndTrips(ids);
  await ensureChats(ids);
  await ensureNotifications(ids);
  await ensureSaved(ids, postsByKey);
  console.log("\n✅ Persona seed complete.");
  console.log(`Login (all personas): password ${PASSWORD}`);
  console.log("Emails: otter.demo+{atlas_marco→marco, neon_zara→zara, ...}@tripotter.app (key = first name)");
  console.log("Fast login still: a@a.co / 123456 (Alice)");
}

main().catch((e) => {
  console.error("Seed failed:", e?.message || e, e?.details || "");
  process.exit(1);
});
