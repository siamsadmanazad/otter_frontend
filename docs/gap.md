# TripOtter — Gap Analysis (Soft Launch)

> **Created:** 2026-06-20 · **Target:** soft launch in 10 days (by ~2026-06-30).
> **Scope (locked with user):** Web **+** Flutter. Must-have Phase-2 stubs = **Journals, Chat (realtime DM),
> Settings + Notifications**. **Companions = heuristic only** (no Gemini for launch). Browser verification first.
> Sibling docs: [`/Plan.md`](./Plan.md) (strategy) · [`/currentplan.md`](./currentplan.md) (the 10-day execution plan) ·
> `otter_backend/rework_backend.md` · `otter_frontend/rework_frontend.md`.

---

## 0. Index
- [1. Scorecard](#1-scorecard)
- [2. Built (do not rebuild)](#2-built--do-not-rebuild)
- [3. Gap table (the worklist)](#3-gap-table--the-worklist)
- [4. Legend](#4-legend)
- [5. Out of scope for soft launch](#5-out-of-scope-for-soft-launch)
- [6. Launch blockers & risks](#6-launch-blockers--risks)
- [7. Execution order](#7-execution-order--see-currentplanmd)

---

## 1. Scorecard

| Area | /100 | Verdict |
|---|---|---|
| Backend (Supabase, hosted) | 90 | 18 tables + RLS + Auth + Storage + 7 RPCs + Realtime live & API-verified. Chat tables already exist. Missing: seed data, observability. |
| Frontend Phase 1 (re-wire) | 75 | All 4 seams done, build green, 22/22 visual snapshots. **Never run in a real browser.** |
| Web Phase 2 (stubs) | 25 | Journals/Chat/Settings/Notifications are stubs. Companions = working heuristic. |
| Flutter client | 2 | Greenfield — only README + .gitignore. |
| **Overall (launch-ready)** | ~60 | Web core is close; gap = browser proof + 4 stub features + Flutter + deploy. |

---

## 2. Built — do not rebuild

| # | Capability | Where | Evidence |
|---|---|---|---|
| B1 | Auth (email/pw, Google OAuth, verify, reset) | `lib/auth/session.tsx`, `app/auth/callback` | E2E verified on hosted (signup→profile trigger→login→cascade). |
| B2 | Feed / posts / comments / likes | `app/api/{feed,posts,comment,reaction}` | API-verified e2e (create→feed→like→comment). |
| B3 | Followers / profiles | `app/api/{followers,users}` | API-verified (follow→count→notification). |
| B4 | Tribes (create/join/browse/search) | `app/api/tribe*`, `get_tribe_by_serial` RPC | API-verified (create→auto-member→join). |
| B5 | Search (profiles + hashtag posts) | `app/api/search`, `search_all` RPC | API-verified. |
| B6 | Media upload → Supabase Storage | `app/api/media`, 4 buckets | Wired; **browser upload not yet exercised.** |
| B7 | Notifications delivery (realtime shim) | `lib/useWebsocket.ts`, `app/api/notifications` | Realtime publication live; **live-push not browser-tested.** |
| B8 | Companions (heuristic) | `app/api/companion` | Returns suggested users you don't follow. Good enough for launch. |
| B9 | DB schema for chat | `otter_backend` migrations | `conversations`, `conversation_participants`, `messages`, `message_reads` + RLS + realtime. |

---

## 3. Gap table — the worklist

> Ordered by execution priority. `Pri`: P0 = launch blocker · P1 = must-have unique · P2 = polish/defer.
> `Eff`: S ≤0.5d · M ≈1d · L ≈2d+. `Repo`: FE=otter_frontend · BE=otter_backend · FL=otter_flutter.

| ID | Gap | Status | Pri | Eff | Repo | Blocks / Notes |
|---|---|---|---|---|---|---|
| **G1** | **Browser smoke** of Phase 1 (login→post w/ image upload→feed→like→comment→follow→tribe→search) | Never run in browser; only via Bearer-token API | P0 | M | FE | De-risks everything. Surfaces first real integration bugs. **Do first.** |
| **G2** | **Realtime live-push** verified in 2 browser sessions (notification appears w/o refresh) | Wired, not browser-tested | P0 | S | FE | Confirms `useWebsocket` shim. Pairs with G1. |
| **G3** | **Journals** submit → persist | **DONE (code) 2026-06-20** — needs browser verify | P1 | S | FE | Wired to posts API as `postType=JOURNAL` (caption=title+body, location); Create Journey tile re-exposed (was commented out). **Fast-follow:** rich-HTML fidelity (add a `content` column + sanitized renderer; today the Tiptap body is flattened to plain text). |
| **G4** | **Notification center** persistence UI (paginate, mark-read, mark-all-read, unread badge) | **DONE (code) 2026-06-20** — needs browser verify | P1 | M | FE | Route got pagination + DELETE; new NotificationAPI; both UIs rewired to the new shape (fixed always-wrong badge + dropped live items). Pairs with G2. |
| **G5** | **Settings tabs** (notifications/privacy/business) | Disabled `opacity-50 grayscale cursor-not-allowed` | P1 | M | FE+BE | Needs prefs column/table on `profiles`. Build forms that save+reload. |
| **G6** | **Chat (realtime DM)** send/receive | Shell UI exists; `useChatLogic` `console.log`s; no message routes | P1 | L | FE | DB tables exist (B9). Build routes (list/create/fetch/send/read/delete) + thread UI + per-conversation realtime channel. |
| **G7** | **Companions intake form** (optional) persisting to `companion_requests` | Page renders heuristic list only | P2 | M | FE | Keep heuristic ranking; light. Defer if time-tight. |
| **G8** | **Flutter client** vs same REST contract (auth, feed, post, tribes, chat, notifications) | Greenfield | P1 | L | FL | Parallel track. Needs `flutter_plan.md` first (missing). **Not bound by web "identical look".** UX goals: **(a) more intuitive feed**, **(b) Reddit-style tribes** (community home, join, sort hot/new, vote/like, post-into-community). Same REST/data contract, fresh mobile UI. |
| **G9** | **Seed data** (demo users/posts/tribes) | None | P1 | S | BE | Needed for realistic soft launch + authed visual baseline. |
| **G10** | **Deploy** web to Vercel (env, build, domain) | Not deployed | P0 | M | FE | Soft launch needs a live URL. |
| **G11** | **Shop/product** uses mock data; `product/[id]` parses int ids | Mock; uuid mismatch | P2 | M | FE | Hide shop nav for launch OR back with Postgres. Recommend hide. |
| **G12** | **Phase-3 polish** (loading/empty/error states, toasts, a11y, mobile) | Inconsistent | P2 | M | FE | Light pass on must-have flows only. |
| **G13** | **Observability** (Sentry), load test, search ranking | None | P2 | M | FE+BE | Post-launch. |
| **G14** | **AI Companions (Gemini)** + server NSFW moderation | Not built | P2 | L | FE+BE | Deferred (user chose heuristic). Drop-in later. |
| **G15** | **Manual/security** items | Pending | P0 | S | — | Rotate DB password; confirm Google OAuth configured; provide RESEND_API_KEY for email; `.env.local` keys present. |
| **G16** | **Finish tsc-clean + drop `ignoreBuildErrors`** | In progress: ~300 hidden errors → **109** (2026-06-20) | P1 | M | FE | Phase 1 was **never** typecheck-clean — `ignoreBuildErrors` masked it; docs over-claimed "build green". Type-decl `_id→id` + de-mongoose done. Residual 109 are per-feature; clear them inside W4/W5/W6 + a final sweep, then remove the ignore flags. |

### Corrections to prior docs (verified 2026-06-20)
- **Phase 1 not actually green:** `pnpm build` only passed because `next.config` still sets `ignoreBuildErrors`/`ignoreDuringBuilds`. `tsc --noEmit` showed ~300 errors. Now 109 after type-decl fixes. See G16.
- **Dead-file list in the cleanup docs was WRONG — do not blind-delete:**
  - `components/tribes-page/tribes-page_v1.01.tsx` is **LIVE** (imported by `app/tribes/page.tsx`). The docs said delete it — don't.
  - `components/tribe-page/tribe-post-card-test.tsx` is **LIVE** (imported by `tribe-posts.tsx`) despite the `-test` name.
  - Actually-dead (one deleted): `components/tribe-page/tribe-post-card.tsx` (deleted), `components/tribes-page/tribes-page_v2.tsx` (unused).
- **Already cleaned (2026-06-20):** deleted leftover `sanity.config.ts`/`sanity.cli.ts` + dead `types/{profile,review}.ts`; fixed `imageUpload.utils` + `rate-limiter.middleware` type bugs; finished `_id→id` in `types/{post,tribes,user}.d.ts` + `NotificationDocument`.

---

## 4. Legend
- **Status** = current reality verified in code/docs on 2026-06-20.
- **Pri P0** must ship or launch fails; **P1** the unique/must-have set; **P2** defer past soft launch.
- **Eff** rough solo estimate; sums to a tight-but-feasible 10 days for P0+P1 with Flutter as a parallel risk.

## 5. Out of scope for soft launch
G11 (shop — hide instead), G13 (observability/load test), G14 (Gemini AI + AI moderation). Tracked for fast-follow.

## 6. Launch blockers & risks
- **R1 — Browser-unproven (G1/G2):** entire web app verified only through API, not a browser. Highest risk; front-loaded.
- **R2 — Flutter scope (G8):** greenfield mobile in a 10-day window alongside web Phase-2 is the schedule risk. Mitigation: REST contract is stable & frozen; Flutter consumes it read-first, then writes. Cut to "auth + feed + post + notifications" MVP if pressed.
- **R3 — Settings prefs schema (G5):** needs a small backend migration (prefs JSON on `profiles`). Coordinate BE↔FE.
- **R4 — Deploy/env (G10/G15):** hosted Supabase keys + Vercel env must align; rotate the DB password before going public.

## 7. Execution order — see [`/currentplan.md`](./currentplan.md)
Sequenced for max efficiency: verify what's built (G1/G2) → land cheap unique wins (G3) → notifications/settings (G4/G5) → chat (G6) → seed + deploy (G9/G10) → Flutter (G8) → polish (G12). Companions intake (G7) only if time remains.
