/**
 * Seed a rich, threaded comment section on one post for a visual design
 * review of the comment thread (alignment, wrapping, nesting, like counts).
 * Unlike seed_comments.mjs (flat, idempotent-skip), this ADDS to whatever is
 * already there and always runs — it's meant to be re-run while iterating on
 * the design, so it does NOT skip if comments already exist. Run with Node 22+.
 *
 *   ~/.nvm/versions/node/v22.22.2/bin/node scripts/seed_thread_diverse.mjs
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

// "Welcome to Work From Anywhere!" — Lena Vogt. Picked because it's the post
// already open in the emulator session being used to verify the share-count
// work, so the new thread is visible without navigating anywhere else.
const POST = "14290337-e4cf-44ee-a5e4-6f02412b2db8";

const U = {
  lena: "37c3f796-6952-4ef7-8e60-ca793fbd033f", // post owner (async_lena)
  marco: "cf787d5d-4d30-4e3f-9a5e-9ab04bbf7ce8",
  zara: "0f3b282e-06b6-4276-85e1-f50221c8468f",
  rowan: "9b35c66e-8b96-483b-aa52-dc80d0a68999",
  victoria: "dbe490ee-164d-4940-9a95-f09bff8db8b2",
  sam: "bdb1ee8a-ce63-4418-bd08-999f4ad223ec",
  kenji: "57f4eb16-2b44-47ea-b2ee-83257aec57c5",
  tariq: "ad6abac5-2f3e-4a9e-8b8a-92351b9c79d3",
  amara: "82251f32-6654-4110-8ab0-7debfb36a97b",
  noah: "3f068a4c-5ddd-4ffc-9425-da363ef7a987",
};

// Deliberately spans the ranges a comment tile needs to survive:
// one-word, one-line, multi-sentence, a long wrapping paragraph, an
// @mention, heavy emoji, and a graduated like_count (0 / hidden -> double
// digits) so the heart+number column's alignment can be eyeballed at every
// width it will actually see.
const TOP_LEVEL = [
  { who: "marco", text: "Following. Need this in my life.", daysAgo: 6, likes: 0 },
  {
    who: "zara",
    text: "Okay I need the wifi speed test screenshot before I commit to anything 😭",
    daysAgo: 5,
    likes: 4,
    key: "zaraWifi",
  },
  {
    who: "kenji",
    text:
      "This is exactly the community I've been looking for. @Lena does the " +
      "co-living have a real kitchen or is it more of a communal-meals setup? " +
      "Trying to figure out if I can actually cook for myself here or if I " +
      "should budget for eating out most nights.",
    daysAgo: 4,
    likes: 12,
    key: "kenjiKitchen",
  },
  { who: "tariq", text: "🙋", daysAgo: 3, likes: 0 },
  {
    who: "victoria",
    text:
      "I did three months at a similar setup in Lisbon last year and honestly " +
      "it ruined regular offices for me — turns out I just work better with a " +
      "view and people around who aren't checked out by 5pm. The only real " +
      "downside was the time zone gymnastics for calls back home, but even " +
      "that got easier once the team adjusted. If anyone's on the fence about " +
      "trying one of these for the first time, this is your sign.",
    daysAgo: 2,
    likes: 34,
    key: "victoriaStory",
  },
  { who: "rowan", text: "in", daysAgo: 1, likes: 1 },
  {
    who: "amara",
    text: "Bookmarking this whole thread, thank you for putting it together 🙏",
    hoursAgo: 5,
    likes: 2,
  },
];

const REPLIES = {
  zaraWifi: [
    {
      who: "lena",
      text: "@Zara fair, I'll do a full wifi + cost breakdown post this week",
      likes: 8,
    },
    { who: "zara", text: "@Lena YES please, tag me", likes: 1 },
  ],
  kenjiKitchen: [
    {
      who: "lena",
      text: "@Kenji shared kitchen, but there's a rotating potluck every Thursday too",
      likes: 6,
    },
  ],
  victoriaStory: [
    { who: "noah", text: "this comment should be its own post honestly", likes: 3 },
    { who: "sam", text: "+1, incredible detail", likes: 0 },
  ],
};

async function main() {
  const now = Date.now();
  const ts = (t) =>
    new Date(
      now - ((t.daysAgo ?? 0) * 24 * 60 + (t.hoursAgo ?? 0) * 60) * 60_000
    ).toISOString();

  const topRows = TOP_LEVEL.map((t) => ({
    content: t.text,
    owner_id: U[t.who],
    post_id: POST,
    created_at: ts(t),
    like_count: t.likes,
  }));
  const { data: inserted, error: e1 } = await db
    .from("comments")
    .insert(topRows)
    .select("id, content");
  if (e1) throw e1;

  // Map each seeded top-level comment back to its `key` (in TOP_LEVEL's
  // order — insert preserves input order) so replies can target the right
  // parent id without a second lookup by content text.
  const idByKey = {};
  TOP_LEVEL.forEach((t, i) => {
    if (t.key) idByKey[t.key] = inserted[i].id;
  });

  const replyRows = [];
  for (const [key, replies] of Object.entries(REPLIES)) {
    const parentId = idByKey[key];
    replies.forEach((r, i) =>
      replyRows.push({
        content: r.text,
        owner_id: U[r.who],
        post_id: POST,
        parent_id: parentId,
        // Replies land within the hour or two after their parent, oldest first.
        created_at: new Date(
          now - (TOP_LEVEL.find((t) => t.key === key).daysAgo * 24 * 60 - (i + 1) * 20) * 60_000
        ).toISOString(),
        like_count: r.likes,
      })
    );
  }
  const { error: e2 } = await db.from("comments").insert(replyRows);
  if (e2) throw e2;

  // posts.comment_count is a total (top-level + replies) — matches
  // /api/comment's own refreshCommentCount, which counts every row for the
  // post with no parent_id filter. Getting this wrong would make the
  // "Comments N" badge under-report once you expand a thread's replies.
  const { count } = await db
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", POST);
  await db.from("posts").update({ comment_count: count ?? 0 }).eq("id", POST);

  console.log(
    `+ seeded ${topRows.length} top-level comments + ${replyRows.length} replies ` +
      `on post ${POST} (comment_count now ${count})`
  );
}

main().catch((e) => {
  console.error("Failed:", e?.message || e, e?.details || "");
  process.exit(1);
});
