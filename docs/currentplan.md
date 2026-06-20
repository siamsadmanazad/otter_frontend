# TripOtter — Soft-Launch Execution Plan (10 days)

> **Snapshot:** 2026-06-20 · **Target launch:** ~2026-06-30 · **Companion gap doc:** [`/gap.md`](./gap.md).
> **Scope locked:** Web **+** Flutter. Must-have stubs = **Journals · Chat · Settings · Notifications**.
> **Companions = heuristic** (no Gemini). **Shop hidden** for launch. **Companions intake = stretch.**
> **Rule:** `.md` files carry guidelines + prompts only — **no code snippets**. Commit + push **after every step**.

---

## ⭐ SESSION HANDOFF — resume here (updated 2026-06-20, end of session 2)

> Read this block first on resume. Everything below it is the longer-form plan.

### Where we are (web is feature-complete in code + builds green)
- **All web work is on `main`** now (we merged the `rework/supabase-rewire` branch → PR #1 → main) so GitHub
  contributions show green. **Keep committing directly to `main` in all three repos** (frontend/backend/flutter)
  — every push is green. **Commit + push after each step.**
- **Web status:** Phase 1 re-wire done; **W0 tsc-clean COMPLETE (0 errors, `ignoreBuildErrors` removed, `pnpm build`
  passes)**; W3 Journals, W4 Notifications, W5 Settings, W6 Chat, W7 Seed + Shop-hidden — **all done in code**.
- **Hosted Supabase** has the seed live (8 demo users; **login pw `OtterDemo!2026`**, emails
  `otter.demo+{alice,ben,…}@tripotter.app`).
- **Flutter:** foundation + **complete data layer done** (this session): `core/` (env, supabase, dio+Bearer
  client, theme, providers) + `models/` + **7 repositories** (auth, feed, tribe, notification, chat, social,
  settings) all `flutter analyze`-clean. **UI screens NOT built yet** (deferred — see next).

### What we were doing when we broke (cross-repo backend-structure pass)
- Reviewed `otter_backend` → backend is structurally complete for built features. Built the **Flutter data layer**
  mirroring the full REST contract, committing each repo after each step.
- **Just finished:** **companion intake** across 3 repos — `POST /api/companion` (persist `companion_requests` +
  heuristic-ranked matches) + Flutter `submitCompanionRequest`. Committed (frontend `108d9cf`, flutter `ff20485`).

### NEXT STEPS (in order) when we resume
1. **Flutter UI/UX + accessibility design pass, then build screens** (the user's stated next focus): auth → shell
   (bottom nav) → intuitive feed → create post/journal → **Reddit-style tribes** → notifications → chat →
   profile/settings. Data layer already exists; wire screens to the repositories. Verify with `flutter analyze` +
   run against hosted via `--dart-define` (seeded account).
2. **Web mobile-view optimization** — **DONE 2026-06-20 (session 2 cont.)**: rebuilt bottom nav (real routes
   Feed/Tribes/Create/Chat/Profile + active states + safe-area + real profileId); added Search to mobile header
   (+ safe-area top); `pb-16` content clearance for the fixed nav; fixed tribes page overflow (`w-[500px]` pill →
   scrollable, edge-to-edge padding); chat thread is full-screen on mobile (nav hidden so the input isn't covered).
   tsc 0, `pnpm build` passes (52/52). **Remaining mobile polish (optional):** per-component a11y/tap-target sweep
   on person-page/settings/companions if desired.
3. **OpenAPI 3.1 spec** in `otter_backend` (Phase 9.4) — documents the contract for Flutter; not yet written.
4. **Hardening** (§16): wire `lib/rate-limiter` into comment/reaction/companion routes; Sentry scaffold (env DSN).

### BLOCKED ON USER (manual — you'll do these)
- **G5 hosted migration:** `profiles.preferences` migration is written + validated locally + committed to
  `otter_backend`, but **needs `supabase db push` to hosted → requires the DB password** (old token revoked → 403).
  Until applied, Settings forms read defaults but can't SAVE against hosted (chat/web otherwise fine — it degrades
  gracefully). Run `! supabase db push` from `otter_backend` (it'll prompt) OR `export SUPABASE_DB_PASSWORD=…`.
- **Vercel deploy (G10): deliberately deferred** (free tier). Deploy config still to be written as prep.
- Other G15: configure Google OAuth in Supabase; add `RESEND_API_KEY`; rotate DB password.

### Verification still owed (needs a running browser/dev server)
- Browser smoke of the core loop (G1), realtime live-push (G2), 2-user chat (G6) — never run in a real browser;
  only API/Bearer-proven. Playwright browser binary is **not installed** (`npx playwright install` to enable visuals).

---

## 🛡️ NEXT FOCUS — Backend Robustness & Completeness Plan (added 2026-06-20)

> Derived from the backend/schema robustness analysis. Schema is production-quality (18 tables, RLS on all, 33
> indexes, 43 checks, 13 RPCs, realtime, storage). These steps close the **robustness gaps**: (i) no live
> rate-limiting, (ii) chat bypasses RLS via service-role, (iii) no server-side moderation, (iv) no OpenAPI spec,
> (v) no automated RLS/contract tests, (vi) no observability. **Each numbered step = one small commit on `main`.**
> AI/Gemini stays deferred (G14). BE=otter_backend · FE=otter_frontend · FL=otter_flutter.

### Phase A — Abuse & rate-limiting (security; highest value)
> `lib/rate-limiter.ts` is in-memory (per-instance) + wired into **zero** routes. Replace with a Postgres-backed
> limiter (one source of truth across serverless instances), then enforce on spam-prone writes.
- **A1 (BE):** Migration — `rate_limit_hit(p_key, p_limit, p_window_seconds) returns boolean` RPC (atomic
  increment+check) backed by a small table. Validate via `supabase db reset`.
- **A2 (FE):** `lib/ratelimit.ts` helper calling the RPC with key `userId|ip + route`; returns allow/deny + retry-after.
- **A3 (FE):** Enforce on **comment POST**. · **A4:** **reaction POST**. · **A5:** **companion POST** (per-user/day).
  · **A6:** **media POST** (upload cap). · **A7:** **chat send POST**. (429 on deny each.)

### Phase B — Authorization hardening (chat → RLS)
> Chat uses service-role admin + hand-rolled JS participant checks. Move to the **actor client** so Postgres RLS
> (`is_conversation_participant`) enforces — defense in depth.
- **B1 (FE):** conversations list/create → actor client. · **B2:** messages fetch/send → actor client.
  · **B3:** read-receipts + soft-delete → actor client. · **B4 (test):** two-user check — user C denied A↔B convo.

### Phase C — Content safety
> NSFW is client-side only → bypassable.
- **C1 (FE):** `/api/media` POST re-checks content **server-side** before storing (422 on explicit); keep client
  check as fast-fail. · **C2 (opt):** text-moderation hook on caption/comment → route flagged to `reports`.

### Phase D — Contract spec & automated tests
- **D1 (BE):** `openapi.yaml` (3.1) for every `/api/*` route — envelope, `id` not `_id`, auth, irregular bodies.
  Single source for Flutter codegen + drift checks.
- **D2 (BE):** RLS test script vs local stack — per-table allow/deny matrix (anon + 2 authed users). Highest-value test.
- **D3 (BE):** Route contract test script — assert envelope + `id` + irregular bodies (reaction `{post}`, etc.).

### Phase E — Observability
- **E1 (FE):** Sentry (env `SENTRY_DSN`, no-op if unset) via a shared `captureRouteError` in the `fail()` path.
  · **E2:** funnel remaining `catch` blocks through it.

### Phase F — User-gated (NOT autonomous)
- **F1:** apply `profiles.preferences` migration to **hosted** (`supabase db push`) — needs **DB password**.
- **F2:** Google OAuth config · `RESEND_API_KEY` · rotate DB password. · **F3 (later):** Gemini AI (Phase 8/G14).

### Execution order & status
Sequence: **A → B → C → D → E**; F anytime (user-gated). A+B = highest-impact security; D2 = highest-value safety net.

| Phase | Steps | Status |
|---|---|---|
| A — rate-limiting | A1–A7 | ⬜ not started |
| B — chat → RLS | B1–B4 | ⬜ not started |
| C — content safety | C1–C2 | ⬜ not started |
| D — spec + tests | D1–D3 | ⬜ not started |
| E — observability | E1–E2 | ⬜ not started |
| F — user-gated | F1–F3 | ⬜ awaiting user |

---

## 0. Index
- [1. Working agreements](#1-working-agreements)
- [2. Execution order (efficiency-sorted)](#2-execution-order--efficiency-sorted)
- [3. Web track — detailed steps](#3-web-track--detailed-steps)
- [4. Flutter track — detailed steps](#4-flutter-track--detailed-steps)
- [5. Launch checklist](#5-launch-checklist)
- [6. Status log](#6-status-log)

---

## 1. Working agreements
- **Repos & branches:** Web → `otter_frontend` branch `rework/supabase-rewire`. Flutter → `otter_flutter` branch `main`
  (create `feature/mvp`). Backend → `otter_backend` branch `main`. Root `trip_otter/` is **not** a repo —
  `gap.md`/`currentplan.md`/`Plan.md` are local-only; mirror key ones into `otter_frontend/docs/` if GitHub visibility is wanted.
- **Commit discipline:** after each numbered step → `git add -A && git commit -m "<phase/step>: <what>" && git push`.
  One step = one reviewable commit. Each commit message ends with the Co-Authored-By trailer.
- **Web prime directive (Phase 1/2):** identical look; new Phase-2 UI reuses existing `components/ui` tokens.
- **Flutter directive:** **not** bound by web look. Build a fresh, intuitive mobile UI; Tribes are **Reddit-style**.
  Same REST contract + data shapes (`API_CONTRACT.md`) — only the presentation differs.
- **Verify each step** before committing: web = `pnpm lint && pnpm tsc --noEmit && pnpm build` + the relevant flow;
  Flutter = `flutter analyze` + run the screen.
- **Don't touch hosted Supabase destructively** without approval; migrations go through `otter_backend` + `db push`.

---

## 2. Execution order — efficiency-sorted

Front-load proof of what's built, then cheapest unique wins, then heavy features, then mobile, then polish.
Web steps W1→W9 are sequential; Flutter F0→F6 can begin once W1 confirms the contract holds live (≈Day 4).

| Day(s) | Step | What | Gap |
|---|---|---|---|
| 1 | W0 | **Finish tsc-clean** (in progress: ~300→109 hidden errors) → then drop `ignoreBuildErrors` | G16 |
| 1 | W1 | Browser smoke of Phase 1 (login→post+image→feed→like→comment→follow→tribe→search) | G1 |
| 1 | W2 | Realtime live-push verified, 2 sessions | G2 |
| 2 | W3 | Journals submit → persist as `postType=JOURNAL` | G3 |
| 2–3 | W4 | Notification center persistence UI | G4 |
| 3–4 | W5 | Settings tabs enabled + prefs persistence (+ small BE migration) | G5 |
| 4–6 | W6 | Chat realtime DM (routes + thread UI + per-conversation channel) | G6 |
| 6 | W7 | Seed data + hide Shop nav + fix `product/[id]` uuid | G9, G11 |
| 6–7 | W8 | Deploy web to Vercel (env, build) + launch hardening | G10, G15 |
| 4–9 | F0–F6 | Flutter MVP (parallel from Day 4) | G8 |
| 9–10 | W9 | Phase-3 polish pass on must-have flows | G12 |
| 10 | — | Soft-launch checklist + go/no-go | §5 |

> If schedule slips: cut **G7** (companions intake) first, then **Flutter writes** (ship read-only mobile),
> then **W9 polish**. Never cut W1/W2/W8.

---

## 3. Web track — detailed steps

> Each step = **Goal · Prompt (paste to drive the work) · Verify · Commit**. Prompts contain the detail; no code here.

### W1 — Browser smoke of Phase 1 (G1)
- **Goal:** prove the API-verified app actually works through a real browser against hosted Supabase.
- **Prompt:** "Start the dev server against hosted Supabase (`.env.local`). Drive the browser through the full core
  flow: sign up a fresh user → confirm profile auto-created → log in → create a post **with an image upload** (verify it
  lands in Supabase Storage and renders from the CDN) → see it in the feed → like it → comment → open another account →
  follow → confirm the followed user's post appears in the personalized feed → create a tribe → join from the 2nd account
  → run a global search and confirm hits. Log every defect found (broken link, undefined field, 401, image not rendering)
  and fix each as a small commit. Do not change layout/styling beyond bug fixes."
- **Verify:** every flow passes in-browser; image visibly renders from `*.supabase.co`; no console errors.
- **Commit:** `phase1/W1: browser smoke fixes`.

### W2 — Realtime live-push (G2)
- **Goal:** confirm notifications arrive without refresh.
- **Prompt:** "Open two browser sessions (User A, User B). Have B follow A, comment on A's post, and like it. Confirm A's
  notification bell/list updates **live without a refresh** via the Supabase Realtime shim in `lib/useWebsocket.ts`. Fix any
  subscription/RLS scoping issue. Report which Supabase channel/postgres_changes feed maps to each notification type."
- **Verify:** live notification appears in <2s in the other session.
- **Commit:** `phase1/W2: realtime live-push verified`.

### W3 — Journals (G3)
- **Goal:** make the existing Tiptap journal editor actually persist.
- **Prompt:** "`components/feed/shared/create-journal.tsx` `onSubmit`/`Saving draft` only `console.log`. Wire submit through
  the existing posts API (`lib/requests.ts` post class) creating a post with `postType=JOURNAL`, including the Tiptap rich-text
  content and any attached media (reuse the create-post media path). Remove the `console.log`s. After submit, the journal must
  appear in the relevant feed and on the author's profile. Do not redesign the editor."
- **Verify:** create a journal → it persists and renders in feed + profile after refresh.
- **Commit:** `phase2/W3: journals submit persists`.

### W4 — Notification center persistence (G4)
- **Goal:** durable, paginated notification center.
- **Prompt:** "Finish the notification center on `app/api/notifications` (GET list + PATCH read already exist). Add cursor/
  page pagination, mark-one-read, mark-all-read, and an unread-count badge. Ensure notifications persist across refresh and
  that W2's realtime delivery **prepends** new ones with the unread badge incrementing. Reuse existing list/skeleton patterns."
- **Verify:** notifications survive refresh; mark-read + mark-all-read work; badge accurate; realtime still prepends.
- **Commit:** `phase2/W4: notification center persistence`.

### W5 — Settings tabs + prefs (G5)
- **Goal:** turn the three disabled settings tabs into working preference forms.
- **Prompt (BE first):** "Add a small `otter_backend` migration: a `preferences jsonb` column on `profiles` (or a `user_preferences`
  table) covering notification toggles, privacy (profile visibility, who-can-message), and business-account fields. Keep RLS
  owner-only. Push to hosted via `supabase db push`."
- **Prompt (FE):** "In `app/settings/page.tsx` remove the `opacity-50 grayscale cursor-not-allowed` disabling on the
  notifications/privacy/business blocks. Build forms (RHF+Zod, existing primitives) that read+write the new prefs through a
  settings route behind `lib/requests.ts`. Gate business fields behind role. Match the existing settings layout. Verify each
  tab saves and reloads correctly."
- **Verify:** each tab persists + reloads; privacy/notif prefs reflected where consumed.
- **Commit:** BE `feat(db): user preferences` · FE `phase2/W5: settings tabs persist`.

### W6 — Chat realtime DM (G6)
- **Goal:** real send/receive DMs (DB tables already exist: `conversations`, `conversation_participants`, `messages`, `message_reads`).
- **Prompt:** "Build chat on the existing schema + shell. Add API routes behind `lib/requests.ts` (same class style): list
  conversations, create/dedupe a direct conversation, fetch messages (cursor pagination), send message, mark read, soft-delete
  message — all authorized via the actor client so RLS `is_conversation_participant` applies. Wire `useChatLogic` (remove its
  `console.log`) and `chat-area`/`chat-list` to these routes. Subscribe to a per-conversation Supabase Realtime channel so a
  message sent in one session appears instantly in the other. Add read receipts + an unread indicator. Match the existing chat
  visual style. Verify a two-user real-time exchange."
- **Verify:** two sessions exchange messages live; read receipts update; pagination loads older messages.
- **Commit:** `phase2/W6: chat realtime DM`.

### W7 — Seed + Shop hide + product uuid (G9, G11)
- **Goal:** realistic demo data; remove dead-end shop.
- **Prompt:** "Add an idempotent seed script (`otter_backend`) creating ~8 demo users, follows, ~20 posts (incl. journals),
  3 tribes with members, and sample notifications — runnable against hosted with a guard so it never duplicates. In the web app,
  hide the Shop nav entry/route for launch (feature-flag, not delete) and fix `app/product/[id]` to treat ids as string/uuid
  (it currently parses integers). Re-baseline the Playwright authed snapshots against the seeded account."
- **Verify:** seed runs clean twice (idempotent); shop hidden; product route no longer int-parses.
- **Commit:** BE `chore(db): seed demo data` · FE `phase2/W7: hide shop + product uuid + re-baseline`.

### W8 — Deploy + hardening (G10, G15)
- **Goal:** live URL on Vercel, secured.
- **Prompt:** "Deploy `otter_frontend` to Vercel: set all env (`NEXT_PUBLIC_SUPABASE_URL`, anon, `SUPABASE_SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`) as Vercel env vars, confirm `pnpm build` passes in CI, set the production domain, and add Supabase Storage
  host to `next.config` remotePatterns. Confirm Supabase Auth redirect URLs include the Vercel domain + Google OAuth (if enabled).
  Smoke the production URL end-to-end."
- **Manual (user):** rotate the hosted DB password; confirm Google OAuth provider configured; provide `RESEND_API_KEY` if email wanted.
- **Verify:** production URL serves the full core flow; auth redirects work.
- **Commit:** `phase2/W8: vercel deploy + prod config`.

### W9 — Polish pass (G12)
- **Goal:** consistent states on must-have flows, light a11y/mobile.
- **Prompt:** "On feed, tribes, notifications, chat, settings: ensure each list has loading skeleton + empty + error states
  (reuse one pattern), standardize Sonner toasts on every mutation, add focus rings/labels to dialogs, verify image `sizes` +
  optimization on, and tighten mobile tap targets + safe-area padding. Additive only — no redesign. Re-run the visual suite."
- **Verify:** visual suite green; no dead spinners/blank states on must-have routes.
- **Commit:** `phase3/W9: polish must-have flows`.

---

## 4. Flutter track — detailed steps

> Greenfield. **Not** bound by web look. **First write `otter_flutter/flutter_plan.md`** (the missing doc), then build.
> Consumes the **same REST contract** (`otter_backend/API_CONTRACT.md`) + Supabase Auth/Realtime. UX goals from user:
> **intuitive feed** and **Reddit-style tribes** (community home, join, sort hot/new, vote/like, post into community).
> Branch `feature/mvp` off `main`. Commit + push after each step.

### F0 — Write `flutter_plan.md` + scaffold
- **Prompt:** "Write `otter_flutter/flutter_plan.md` (guidelines + prompts, no code): target Flutter stable, state mgmt
  (Riverpod), `supabase_flutter` for auth+realtime, `dio` for the REST contract, routing (go_router). Define screen list,
  the data models mirroring `API_CONTRACT.md` shapes (camelCase, `id`, keep `serial`), and the auth-token flow (Supabase
  session → `Authorization: Bearer` to the Next.js API). Then scaffold the project: app shell, theme (carry TripOtter
  teal→cyan identity but native patterns), bottom nav, and an API client + auth provider."
- **Commit:** `flutter/F0: plan + scaffold`.

### F1 — Auth
- **Prompt:** "Implement Supabase auth in Flutter: email/password login + signup + logout, session persistence, and a guard
  that routes unauthenticated users to login. Reuse the same Supabase project. Verify a web-created account logs in on mobile."
- **Commit:** `flutter/F1: auth`.

### F2 — Intuitive feed
- **Prompt:** "Build the home **feed** as a clean, intuitive mobile experience (not a web clone): infinite scroll, pull-to-refresh,
  rich post cards (author, media, like/comment counts), tap→detail, like + comment inline. Source from the existing feed API
  via Bearer token. Prioritize readability, large tap targets, and fast perceived load (skeletons)."
- **Commit:** `flutter/F2: feed`.

### F3 — Create post + journal
- **Prompt:** "Add create-post (text + image upload via the media API to Supabase Storage) and a journal composer
  (`postType=JOURNAL`, rich-ish text). New posts appear in the feed."
- **Commit:** `flutter/F3: create post/journal`.

### F4 — Reddit-style Tribes
- **Prompt:** "Build Tribes as **Reddit-style communities**: a browse/discover list, a community home screen (banner, about,
  member count, **Join/Leave**), a community feed with **sort (Hot / New)**, **upvote/like** on posts, and **post-into-community**.
  Reuse the tribe + posts APIs (tribes looked up by `serial`). Make joining and posting feel first-class on mobile."
- **Commit:** `flutter/F4: reddit-style tribes`.

### F5 — Notifications + realtime
- **Prompt:** "Add the notification center (list + unread badge) and subscribe to Supabase Realtime so new notifications arrive
  live, mirroring the web shim's event mapping. Mark-read + mark-all-read."
- **Commit:** `flutter/F5: notifications realtime`.

### F6 — Chat (if web W6 landed) + profile/settings
- **Prompt:** "Add 1:1 chat against the chat routes from W6 with per-conversation realtime, plus a basic profile + settings
  screen (prefs from W5). If schedule is tight, ship chat read-only or defer chat and keep profile/settings."
- **Commit:** `flutter/F6: chat + profile/settings`.

---

## 5. Launch checklist
- [ ] W1/W2 browser + realtime proven on hosted.
- [ ] Journals, Notifications, Settings, Chat functional (no stubs/dead buttons on shipped routes).
- [ ] Seed data loaded; Shop hidden; product route uuid-safe.
- [ ] Web deployed to Vercel; auth redirects + Storage host configured; prod smoke passed.
- [ ] DB password rotated; Google OAuth + Resend configured as needed.
- [ ] Flutter MVP (auth + intuitive feed + Reddit-style tribes + notifications) installable + pointed at prod.
- [ ] Visual suite green; no console errors on must-have flows.
- [ ] Go/no-go review.

## 6. Status log
- 2026-06-20 — Plan + `gap.md` authored. Scope locked (Web+Flutter; Journals/Chat/Settings/Notifications; heuristic Companions;
  shop hidden). Flutter UX direction added: intuitive feed + Reddit-style tribes.
- 2026-06-20 — **W0 started.** Discovered Phase 1 was never tsc-clean (~300 errors hidden by `ignoreBuildErrors`). Fixed:
  removed leftover Sanity + dead mongoose type files; fixed `imageUpload`/`rate-limiter` bugs; finished `_id→id` in
  `types/{post,tribes,user}.d.ts` + `NotificationDocument`; deleted dead `tribe-post-card.tsx`. **Errors 300 → 109.**
  Corrected the docs' wrong dead-file list (see `gap.md` "Corrections"). 4 commits pushed to `rework/supabase-rewire`.
- 2026-06-20 — **W3 Journals DONE (code).** `create-journal` now persists via the posts API as `postType=JOURNAL` (Dialog+
  mutation like CreatePost; feed invalidation; Save Draft → localStorage). Re-exposed the "Create Journey" tile in the composer
  (it was commented out with a broken import → journals were unreachable). Typecheck-clean, 0 new errors. Commit `3aebd31`.
  Fast-follow noted: rich-HTML fidelity needs a `content` column + sanitized renderer (today body is flattened to plain text).
- 2026-06-20 — **W4 Notification center DONE (code).** Route: pagination + DELETE. New `NotificationAPI`. Both UIs (bell +
  page) rewired from the dead socket/old-shape to TanStack Query on the API with the NEW shape — fixes the always-wrong unread
  badge and the live guard that silently dropped every realtime item. Added page pagination + states. tsc 109 → 102. Commit `2f8f819`.
- **DECISION POINT — W5 needs a hosted DB migration.** `profiles` has no preferences column; Settings tabs need
  `preferences jsonb`. Per project rule, applying to the hosted Supabase needs user approval. Options: (a) add migration +
  push to hosted now, (b) build migration local-only + defer hosted apply, (c) skip W5, do **W6 chat** next (chat tables already
  exist → no new DB). Awaiting user.
- 2026-06-20 — **W6a Chat backend DONE.** Routes (conversations list/create-direct, messages fetch/send, read, soft-delete)
  + `ChatAPI`/`useChatApi` on the existing schema; admin client + participant checks. Typecheck-clean, 0 new errors. Commit `51ac1b5`.
- **W6b Chat UI rewire = the next big piece** (and best done against a live browser): rewire `useChatLogic`/`chat-page`/`chat-area`/
  `chat-list` from the dead socket model to `useChatApi` + a per-conversation Supabase Realtime channel; scope to DIRECT DMs
  (schema has no presence/global-chat); add read receipts + unread. ~1.6k lines touched — verify in a running app.
- 2026-06-20 — **Dev server up against hosted** (health = DB hit; chat/notif routes alive). **W6b Chat UI DONE.** Rewired
  `useChatLogic` + shell off the dead socket model to REST + one RLS-scoped Realtime channel (direct DMs, new-chat picker,
  unread dot, load-older, mobile back). Retired group-dialog/multiselect (out of DM scope). `/chat` compiles + serves 200.
  tsc 102 → 89. Commit `30d77ea`. Per-message "seen" + groups = fast-follow.
- **NEEDS BROWSER VERIFY (2 users):** journals publish (W3), notification center + live push (W4), and the **chat two-user
  realtime exchange** (W6). Server is running at http://localhost:3000 — walk the flows and report; I'll fix what surfaces.
- **Remaining after verify:** W5 Settings (needs the approved `preferences` migration), W7 seed+shop-hide, W8 deploy, W9 polish;
  Flutter F0–F6; and W0 tail (89 → 0 tsc + drop ignore flags).
- 2026-06-20 — **W5 Settings + W7 Seed/Shop DONE (per build_settings_seed.md).** A1 prefs migration validated locally + committed;
  A2 settings API; A3 three working tabs; A4 whoCanMessage enforced (graceful pre-migration). B1 idempotent seed → **applied to
  hosted** (8 users + content; demo pw `OtterDemo!2026`); B3 Shop hidden behind `SHOP_ENABLED` + route redirects. Commits
  0909de2..e4bf7b5. tsc 102 → 89.
- **ONE BLOCKER for W5 on hosted:** `supabase db push` needs the hosted **DB password** (old access token revoked → 403). Until
  applied, the Settings forms read defaults but can't save against hosted (chat-create stays fine — it degrades gracefully).
  Provide the DB password (set `SUPABASE_DB_PASSWORD`) or run `supabase db push` from otter_backend.
