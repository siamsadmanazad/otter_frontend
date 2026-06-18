# TripOtter Frontend — Rework Guide (Supabase Re-wire)

> **Read [`/Plan.md`](../Plan.md) first.** This document is the execution guide for **Workstreams
> B, C, and D**: re-wire the existing frontend to the new Supabase backend, finish the stubbed
> features, then polish.
>
> **Audience:** engineers driving Claude Code CLI.
> **Format rule:** this file contains **no code snippets** — only guidelines, ordered steps, and
> copy-paste CLI **prompts**. Implementation detail lives in the prompts, not in this doc.

---

## Prime Directive

> **After Phase 1, the app must look and behave EXACTLY as it does today.** Same pages, same layout,
> same theme, same flows. We are swapping the engine, not the body. UI/UX changes are allowed only in
> **Phase 3 (Polish)** and only as additive refinement — never a redesign.

To make "identical" verifiable, **capture a visual baseline before touching anything** (see Phase 0,
Step 1). Every later phase is checked against that baseline.

---

## Table of Contents
1. [Why This Rework Exists](#1-why-this-rework-exists)
2. [The Three Seams](#2-the-three-seams)
3. [Current Status & Known Lackings](#3-current-status--known-lackings)
4. [Phase 0 — Preparation](#4-phase-0--preparation)
5. [Phase 1 — Re-wire to Supabase (identical look)](#5-phase-1--re-wire-to-supabase-identical-look)
6. [Phase 2 — Finish Stubbed Features](#6-phase-2--finish-stubbed-features)
7. [Phase 3 — UI/UX Polish](#7-phase-3--uiux-polish)
8. [Verification](#8-verification)
9. [Appendix — Keep / Rebuild / Update Map](#9-appendix--keep--rebuild--update-map)

---

## 1. Why This Rework Exists

The previous developer took the backend. The `app/api/*` routes, the Mongoose schemas, the NextAuth
config, and the `tripotter-pulse` realtime service are all dead. The **UI is intact and modern** and
is worth keeping. This guide re-points that UI at a **Supabase backend** reached through the existing
REST seam, finishes the half-built features, and polishes the result.

This guide is the consumer of the Supabase backend (Workstream A), specified in
`otter_backend/rework_backend.md`. Re-wire each frontend seam as its backend counterpart comes online.

### Repository layout & git

The three folders are **three separate GitHub repos**, not a monorepo:
- `otter_frontend` → `github.com/siamsadmanazad/otter_frontend` — **this repo** (branch `main`,
  `origin` set). All work in this guide happens here.
- `otter_backend-` → `github.com/siamsadmanazad/otter_backend-`
- `otter_flutter` → `github.com/siamsadmanazad/otter_flutter`

The container folder `trip_otter/` is **not** a git repo. Consequence: cross-doc relative links
(`../Plan.md`, `../otter_backend/rework_backend.md`) resolve on the local filesystem but **not** on
GitHub, and `Plan.md` at the container root is not version-controlled in any repo. If you want the plan
and backend guide visible inside this repo, keep copies under `otter_frontend/docs/`. (Team flag, not
an execution blocker.)

### Working agreement with the backend (Workstream A)

- **The frontend is the contract source of truth.** `lib/requests.ts` (request/response shapes) and
  `types/*` define what each endpoint must return. The backend matches these; the only global change
  is `_id → id` (see [§2 Data-shape contract](#2-the-three-seams)).
- **Interleave, don't block.** Build + verify one endpoint group in the backend, re-wire its caller
  here, verify, then move to the next — in the dependency order in [§5.2](#52-data-seam-rebuild-routes-behind-librequeststs).
- **Fallback when an endpoint isn't ready:** keep that route returning a **typed stub** (empty/mock
  data in the existing shape) behind a `// TODO(rework): wire to Supabase` marker so the app keeps
  compiling and rendering. Never hold the whole re-wire hostage to one endpoint.

---

## 2. The Three Seams

Almost all the work concentrates in three abstraction points. **Components stay untouched** because
they only ever talk to these:

| Seam | File(s) | What changes |
|---|---|---|
| **Data** | `lib/requests.ts` (+ `app/api/*`) | Keep the class API surface (`usePostApi`, `useUserApi`, …). Rebuild the route handlers behind it on Supabase. Rename data shape `_id → id`. |
| **Auth** | `auth/index.ts`, `app/providers.tsx`, login/signup/forgot/verify pages | Replace NextAuth with Supabase Auth behind a `useSession`-compatible wrapper so callers don't change. |
| **Realtime** | `lib/useWebsocket.ts` | Keep the exported hook shape; rebuild internals on Supabase Realtime. Remove socket.io + pulse URLs. |
| **Media** (4th, smaller) | `lib/getSanityImage.ts`, `app/api/media`, upload components | Replace Sanity with Supabase Storage; re-point image URLs; keep `nsfwjs`. |

**Rule of thumb:** if a change would require editing a component's JSX/layout, stop — it almost
certainly belongs in a seam instead. The only sanctioned component edits in Phase 1 are the
mechanical `._id → .id` rename and auth-call updates on the auth pages.

### Data-shape contract (read before the data seam)

Postgres columns are `snake_case`; the existing UI and `types/*` expect **`camelCase`** (`fullName`,
`profileImage`, `coverImage`, `postType`, `fromGroup`, `usersCount`, …). To keep components untouched:

- **The route handler / RPC response maps `snake_case` → the existing `camelCase` field names.** That
  mapping lives in the API layer — never push it onto components. (The backend guide locks the same
  convention.)
- **The only field the UI renames is `_id → id`.** Update `types/*` and the few components that read
  `._id` to read `.id`.
- **`serial` stays `serial`.** Several entities (notably **tribes**) are looked up by `serial`, not
  `id` — do **not** rename or drop it; preserve every serial-based lookup and route param.
- If a field's name or nesting genuinely must change, treat it as a contract change: update
  `lib/requests.ts` + `types/*` **together** so the component still reads the same property name.

---

## 3. Current Status & Known Lackings

### Feature status (verified)

| Feature | Status | Note |
|---|---|---|
| Auth (email + Google, verify, forgot) | ✅ UI built | Backend dead — re-wire to Supabase Auth |
| Feed / posts / comments / likes | ✅ UI built | Re-wire to Supabase |
| Followers / profiles | ✅ UI built | Re-wire to Supabase |
| Tribes (create/join/browse/filter) | ✅ UI built | Re-wire to Supabase |
| Search (users/tribes/shops/hashtags) | ✅ UI built | Re-wire to Postgres FTS |
| Notifications | ⚠️ Partial | Realtime delivery existed; persistence path unclear — Phase 2 |
| Companions | ⚠️ Stub | Page exists; matching not implemented — Phase 2 |
| Chat | ⚠️ Stub | Shell exists; send/receive UI missing — Phase 2 |
| Journals | ⚠️ Stub | Tiptap editor exists; submit only `console.log`s — Phase 2 |
| Settings tabs (notif/privacy/business) | ⚠️ Disabled | `opacity-50 pointer-events-none` — Phase 2 |
| Shop / products | ⚠️ Mock data | Decide source (Postgres) during re-wire |

### Concrete defects to fix during re-wire
- Hardcoded `localhost:10000` in password-reset / verification paths.
- `console.log`s left in `chat-page.tsx`, `create-journal.tsx`.
- `getPublicFeed_v2()` crashes on empty `joinedTribes` / `createdTribes` arrays.
- `getTribeBySerial()` aggregation never populated the creator — must return creator on the new query.
- `product/[id]` parses IDs as integers — incompatible with uuid keys; fix to string/uuid.
- Disabled settings tabs are visual dead-ends.
- Dead files to delete: `components/chat-page/chat-page..old.tsx`,
  `components/tribes-page/tribes-page_v1.01.tsx`, empty `app/test/`, `data/mocks/` once unused.
- `next.config.mjs` masks lint/TS errors and disables image optimization.

---

## 4. Phase 0 — Preparation

> Goal: a clean, reproducible starting point with Supabase wired in and the dead-backend deps gone —
> **before** any feature is touched.

> ### 🔁 Commit discipline (applies to every step, every phase)
> All work happens on the `rework/supabase-rewire` branch. **After each numbered step below — and
> after each seam/feature in later phases — commit and push:**
> ```
> git add -A
> git commit -m "<phase/step>: <what changed>"   # e.g. "phase0/step2: pin latest deps to semver"
> git push origin rework/supabase-rewire
> ```
> Keep commits small and per-step so any step is independently reviewable and revertible. Open a PR
> against `main` early and let it accumulate the branch's commits.

**Step 1 — Visual baseline.** Capture the current look so "identical" is provable later.

```
Produce a visual baseline of the CURRENT UI before any changes — both human-viewable AND machine-diffable.
1. Run the dev server. List every route from the App Router (read app/ for page.tsx files).
2. Add Playwright (dev-dependency) and a visual-snapshot test that visits every reachable route at
   desktop (1440px) and mobile (390px) widths and saves baseline screenshots (toHaveScreenshot). Cover
   logged-out AND logged-in states for auth-gated routes — use a seeded/test account once the backend
   seed exists; until then capture logged-out + the auth pages. Disable animations for determinism.
3. Also export the screenshots to /baseline-screens/ for human reference and write
   baseline-screens/INDEX.md listing each route, its files, and a one-line "what should render" note.
4. Commit the Playwright snapshot baseline so Phase 1 can run `pnpm exec playwright test` to diff
   automatically. Do NOT change any application code in this step.
```

**Step 2 — Branch & dependency hygiene.**

```
Prepare the frontend for the Supabase rework without changing behavior.
1. This is a standalone git repo (otter_frontend) on branch `main` with `origin` on GitHub. Create and
   switch to a branch `rework/supabase-rewire` from `main`, and push it to `origin` so work happens on a
   PR. (All git actions are inside otter_frontend — the container folder trip_otter is not a repo.)
2. In package.json, replace every dependency pinned to "latest" with the exact version currently
   resolved in pnpm-lock.yaml (read the lockfile to find each resolved version). Do not upgrade
   anything — just pin to what is already installed.
3. Run pnpm install and confirm the lockfile is unchanged in terms of resolved versions.
4. Run pnpm build to confirm the app still builds. Report any errors but do not fix features yet.
Report a summary of every version you pinned.
```

**Step 3 — Tooling.**

```
Add code-quality tooling that is currently missing.
1. Add an ESLint config appropriate for Next.js 15 + React 19 + TypeScript, and a Prettier config.
2. Add "lint" and "format" scripts to package.json if not present.
3. Do NOT yet remove the eslint.ignoreDuringBuilds / typescript.ignoreBuildErrors flags in
   next.config.mjs — leave a TODO comment to remove them once the codebase is lint/type clean.
4. Run the linter and report the error/warning count grouped by file. Do not fix them yet.
```

**Step 4 — Install Supabase, remove dead deps.**

```
Swap the dependency set from the old (dead) backend to Supabase. Do not wire anything up yet.
1. Add @supabase/supabase-js and @supabase/ssr.
2. Remove these now-dead dependencies and any imports that reference them (leave the calling code
   compiling by stubbing/commenting the call sites with a clear // TODO(rework): replace with Supabase
   marker — we re-wire them in Phase 1): mongoose, socket.io-client, next-auth, @auth/core, bcrypt,
   bcryptjs, jsonwebtoken, all @sanity/* packages, next-sanity, nodemailer.
3. Create lib/supabase/ with a browser client and a server client module using @supabase/ssr
   (read Supabase's current Next.js App Router SSR guidance). Read URL and keys from env. Fail loudly
   if missing. Add a service-role server client for use ONLY inside app/api routes.
4. Rewrite .env.example: remove MONGODB_URI, AUTH_* (NextAuth), JWT_SECRET, all SANITY_*,
   PULSE_BASE_URL, NEXT_PUBLIC_PULSE_BASE_URL, NEXT_PUBLIC_WS_BASE_URL. Add NEXT_PUBLIC_SUPABASE_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, plus the retained GOOGLE_GENAI_API_KEY
   and RESEND_API_KEY. Add comments for where to get each.
5. Run pnpm tsc --noEmit and report what still references the removed packages.
```

**Phase 0 milestone:** branch created · deps pinned · ESLint/Prettier present · Supabase clients
exist · `.env.example` reflects the new stack · dead-backend packages removed · baseline screenshots
captured.

---

## 5. Phase 1 — Re-wire to Supabase (identical look)

> Goal: the app runs entirely on Supabase and is **visually indistinguishable** from the baseline.
> Re-wire seam by seam. After each seam, run the verification and compare to `/baseline-screens/`.

### 5.1 Auth seam (do this first — everything depends on a session)

```
Replace NextAuth with Supabase Auth WITHOUT changing how components consume the session.
1. Inventory every next-auth usage: useSession, signIn, signOut, SessionProvider, getServerSession,
   and the session.user shape ({ id, serial, username, name, email, image }).
2. Build a useSession-compatible hook that returns the EXACT NextAuth shape so no component changes:
   `{ data: Session | null, status: "loading" | "authenticated" | "unauthenticated" }`, where
   `data.user = { id, serial, username, name, email, image }`. Drive it from Supabase: read the initial
   session with getSession(), then subscribe to onAuthStateChange to keep status/data live. Map the
   Supabase user + the profiles row onto session.user (id = profiles.id, name = full_name,
   image = profile_image, etc. — per §2 Data-shape contract). Preserve the "loading" status so guards
   that wait on it still behave.
3. Build a SessionProvider-compatible (Supabase-backed) provider and mount it in app/providers.tsx in
   place of NextAuth's.
4. Use @supabase/ssr for cookie-based sessions so Server Components and Route Handlers share auth.
   Provide a server helper getServerUser() that reads the session from cookies (replacing
   getServerSession) and returns the caller's profile id or null.
5. For API-route authorization, resolve the user via the @supabase/ssr server client (cookies) AND also
   accept an `Authorization: Bearer <access_token>` header, so the future Flutter client uses the same
   routes. Return 401 when neither yields a user.
6. Re-wire the auth pages to Supabase: login (email/password + Google OAuth via signInWithOAuth),
   signup, forgot-password (resetPasswordForEmail), verify/[id] (Supabase recovery/verify flow), and
   signOut in the sidebar. Remove the hardcoded localhost:10000 reset path entirely.
7. Delete auth/index.ts (NextAuth config) once nothing imports it.
Constraint: do not change the visual appearance of the auth pages. Verify login, logout, signup, Google
OAuth, password reset, session persistence across refresh, and that every page previously gated by
useSession still gates correctly (including the loading state).
```

### 5.2 Data seam (rebuild routes behind `lib/requests.ts`)

> Keep the `lib/requests.ts` class structure and exported singletons exactly. Rebuild each
> `app/api/*` route against Supabase. Do them in dependency order: users/profiles → posts → comments
> → reactions → followers → feed → tribes → search → media → companion/journey/notifications/etc.

```
Re-wire the DATA layer to Supabase, one endpoint group at a time, keeping lib/requests.ts's public
API identical.
1. Pick the next endpoint group (start with users). Read its current app/api/<group>/route.ts and the
   matching class in lib/requests.ts to capture the exact request/response contract the UI expects.
2. Rebuild the route handler against Supabase Postgres using the service-role server client. Preserve
   the response shape the UI consumes and FOLLOW THE DATA-SHAPE CONTRACT (§2): map Postgres snake_case
   columns back to the existing camelCase field names in the response; the only renamed field is
   _id → id; keep serial unchanged.
3. Re-create any multi-table atomic operation (e.g. the like toggle across Post + Profile + Like) by
   calling the backend's Postgres RPC (e.g. toggle_like) rather than hand-rolling multi-step writes.
4. Keep Zod validation. Add auth to every write via the §5.1 getServerUser()/bearer helper.
5. Update types/* (_id → id; keep serial) and update only the components that read ._id (grep ._id
   across components/ and app/) to read .id. This is the only sanctioned component edit here.
6. Re-implement the known-broken logic correctly: feed v2 guards empty following/tribe arrays and falls
   back to the public feed; tribe-by-serial returns the populated creator; product/[id] uses
   string/uuid ids (it currently parses integers).
7. If the backend endpoint isn't ready yet, leave a typed stub per the §1 working agreement instead of
   blocking. Verify the group end-to-end against the running app, then move on.
Do not change UI layout or styling. Report the final contract for each rebuilt endpoint.
```

### 5.3 Realtime seam

```
Replace socket.io + tripotter-pulse with Supabase Realtime, keeping lib/useWebsocket.ts's exported
hook surface identical so consumers don't change.
1. Read lib/useWebsocket.ts and every component that consumes it (grep for the hook import, socket.on,
   socket.emit): message-container, notification-container, person-page, follow-button, post-container,
   useChatLogic.
2. Rebuild the hook on Supabase Realtime channels, exposing the SAME return shape (e.g. subscribe /
   unsubscribe / isConnected and whatever the current hook returns). Map the old socket events
   (notification, message, createNotification, joinRoom) onto Supabase channel events / Postgres
   changes subscriptions scoped by RLS.
3. Remove every reference to NEXT_PUBLIC_WS_BASE_URL, PULSE_BASE_URL, and the dev-tunnel fallback.
4. Verify real-time notifications appear without refresh (two browser sessions, one follows the other).
Do not change any component's JSX. Report which events map to which Supabase channels.
```

### 5.4 Media seam

```
Move media from Sanity to Supabase Storage without changing how images appear.
1. Identify every image read/write path: lib/getSanityImage.ts, lib/sanity.ts, app/api/media, the
   upload components (react-dropzone usage), and the Sanity Studio route.
2. Create Supabase Storage buckets (e.g. avatars, covers, posts) with appropriate RLS policies (the
   exact policies are defined in the backend guide; assume they exist). Rebuild /api/media to upload
   to Supabase Storage (or issue signed upload URLs) and return the public/CDN URL. Keep the nsfwjs
   check before upload. Keep HEIC conversion.
3. Replace getSanityImage with a single Supabase image-URL helper used everywhere images are rendered.
4. Update next.config.mjs images.remotePatterns to allow the Supabase Storage CDN host, and re-enable
   image optimization (remove unoptimized: true) — verify images still render at the same sizes.
5. Remove the Sanity Studio route and any shop/product content that depended on Sanity; source that
   content from Postgres instead (or keep it as static for now and note it for Phase 2).
Do not change image layout/styling. Verify avatars, covers, post images, and uploads all work.
```

### 5.5 Cleanup

```
Remove dead artifacts now that the re-wire is complete.
1. Delete lib/mongo.ts, lib/dbConnect.ts, lib/useDB.ts, utils/schema/* (Mongoose), auth/index.ts,
   lib/getSanityImage.ts, lib/sanity.ts, sanity/ — confirm nothing imports them first.
2. Delete dead files: components/chat-page/chat-page..old.tsx,
   components/tribes-page/tribes-page_v1.01.tsx, app/test/, and unused data/mocks/.
3. Remove leftover console.log debug lines in chat-page.tsx and create-journal.tsx.
4. Grep the whole repo for: mongoose, _id, socket.io, pulse, sanity, localhost:10000, next-auth —
   report any remaining references.
5. Run pnpm lint && pnpm tsc --noEmit && pnpm build. Once clean, remove the ignoreDuringBuilds /
   ignoreBuildErrors flags from next.config.mjs and build again.
```

**Phase 1 milestone:** app runs fully on Supabase · all four seams re-wired · `_id → id` complete ·
no references to the old stack · `lint`/`tsc`/`build` all green · **UI matches `/baseline-screens/`.**

---

## 6. Phase 2 — Finish Stubbed Features

> Goal: complete the half-built features so the web app is feature-complete. Each is independent;
> ship them one at a time with verification. New UI here must match the existing design language
> (reuse `components/ui` primitives, the existing color/spacing/typography tokens).

```
Build out the CHAT feature on top of the existing chat-page shell and Supabase Realtime.
- Data: conversations and messages tables (assume backend provides them; if not, coordinate with the
  backend guide). Support direct + group conversations, read receipts, soft delete.
- API: list conversations, create/dedupe direct conversation, fetch messages (cursor pagination),
  send message, mark read, delete message — all behind lib/requests.ts in the same class style.
- UI: build ConversationList, MessageThread (infinite scroll up, auto-scroll on new), MessageInput
  (Enter to send, Shift+Enter newline), NewConversationModal, typing indicator and read receipts.
- Realtime: subscribe to a per-conversation channel; messages appear instantly in a second session.
Match the existing visual style. Remove the leftover console.logs. Verify two-user real-time exchange.
```

```
Build the COMPANIONS matching feature.
- A form capturing destination, dates, interests, budget, travel style (use existing form primitives +
  RHF + Zod).
- POST to /api/companion which persists the request and runs AI matching via Gemini SERVER-SIDE only
  (never expose the key). Return ranked matches with reasons.
- Render results with View Profile / Start Chat CTAs. Rate-limit the endpoint per user per day.
Match the existing card/list visual language. Verify the flow returns matches.
```

```
Wire the JOURNALS submit path.
- The Tiptap editor and create-journal UI already exist; currently submit only console.logs.
- Persist the journal (postType JOURNAL) through the posts API, including rich-text content + media.
- After submit, the journal appears in the relevant feed/profile.
Do not redesign the editor. Verify a created journal persists and renders.
```

```
Enable the disabled SETTINGS tabs (notifications, privacy, business).
- Remove the opacity-50 / pointer-events-none disabling.
- Build preference forms that persist to a user preferences store (table/column provided by backend).
- Notifications: per-type toggles. Privacy: profile visibility / who-can-message. Business: the
  business-account fields (gate behind role where appropriate).
Match the existing settings page layout. Verify each tab saves and reloads correctly.
```

```
Finish NOTIFICATION persistence.
- Ensure notifications persist to Postgres (recipient, actor, type, target, read, timestamps),
  paginate in the notification center, mark-read and mark-all-read work, and the realtime delivery
  from Phase 1 prepends new ones with an unread badge.
Verify persistence survives refresh and realtime still works.
```

**Phase 2 milestone:** chat, companions, journals, settings tabs, and notification persistence all
functional; no stubs or dead buttons remain.

---

## 7. Phase 3 — UI/UX Polish

> Goal: tighten quality **without altering the product's identity.** These are additive refinements.
> Get sign-off before any change that alters layout/branding. Keep the teal→cyan gradient identity,
> the sidebar/bottom-nav structure, and the card-based language.

Suggested, conservative improvements (pick per value/effort):
- **State consistency:** ensure every list/route has proper loading (skeletons), empty, and error
  states — reuse one skeleton + one empty-state pattern across feed, tribes, search, chat, notifications.
- **Toast consistency:** standardize Sonner usage (success/error/info) across all mutations.
- **Accessibility pass:** focus traps + labels on Radix dialogs/menus, keyboard nav, visible focus
  rings, color-contrast check on the gradient overlays, alt text on images.
- **Performance:** confirm image optimization is on and sized correctly; lazy-load below-the-fold
  media; verify `next/image` `sizes`; code-split heavy modals (create-post, editor) as today.
- **Mobile refinements:** safe-area padding, tap target sizes, bottom-nav active states.
- **Micro-interactions:** subtle hover/press feedback using the existing animation tokens — no new
  motion language.
- **Forms:** inline validation messaging consistency (RHF + Zod error display).

**Phase 3 milestone:** consistent states, a11y improved, perf verified, mobile tightened — and the
app is still recognizably the same product as the baseline.

---

## 8. Verification

Run after every seam (Phase 1) and every feature (Phase 2):

1. **Static gates:** `pnpm lint && pnpm tsc --noEmit && pnpm build` all exit 0.
2. **Auth flow:** signup → email verify → login → logout → Google OAuth → password reset.
3. **Core flows:** create post (with image) → appears in feed → comment → like → follow a user →
   their posts appear in personalized feed → create/join a tribe → post to tribe → global search hits.
4. **Realtime:** two sessions; a follow/notification/message in A appears in B without refresh.
5. **Media:** upload avatar/cover/post image; all render from the Supabase CDN at correct sizes.
6. **Visual parity (Phase 1):** run the Phase 0 Playwright visual-snapshot suite — it must pass with
   zero unexpected pixel diffs at desktop + mobile across every route. Spot-check `/baseline-screens/`
   for anything snapshots can't catch. Any visible difference is a regression unless it's an intentional
   Phase 3 change (only then re-baseline, deliberately and reviewed).
7. **No old-stack references:** grep clean for `mongoose`, `socket.io`, `pulse`, `sanity`, `_id`,
   `next-auth`, `localhost:10000`.

---

## 9. Appendix — Keep / Rebuild / Update Map

| Path | Action |
|---|---|
| `components/**` | **Keep** (Phase 1). New components only in Phase 2/3, matching existing style. |
| `app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` | **Keep** routing/layout. |
| `hooks/**`, `styles/**`, `public/**` | **Keep**. |
| `lib/requests.ts` | **Keep API surface**; rebuild HTTP targets. |
| `lib/useWebsocket.ts` | **Keep hook surface**; rebuild on Supabase Realtime. |
| `types/**` | **Update** (`_id → id`). |
| `app/providers.tsx` | **Update** to Supabase-backed session provider. |
| Auth pages (`login`, `signup`, `forgot-password`, `verify/[id]`) | **Update** auth calls only; keep UI. |
| `app/api/**/route.ts` (24) | **Rebuild** on Supabase. |
| `lib/mongo.ts`, `lib/useDB.ts`, `lib/dbConnect.ts` | **Delete** (replace with Supabase clients). |
| `utils/schema/**` (Mongoose) | **Delete** (replaced by Postgres migrations). |
| `auth/index.ts` (NextAuth) | **Delete** (replaced by Supabase Auth). |
| `lib/getSanityImage.ts`, `lib/sanity.ts`, `sanity/**` | **Delete** (replaced by Supabase Storage). |
| `lib/supabase/*` | **Create** (browser, server, service-role clients). |
| Dead files (`*..old.tsx`, `*_v1.01.tsx`, `app/test/`, unused `data/mocks/`) | **Delete**. |
| `.env.example`, `next.config.mjs` | **Update** (new env vars; image optimization; remove ignore flags when green). |

---

> **Next:** the Supabase backend this guide re-wires against is specified in
> `otter_backend/rework_backend.md`. Re-wire each seam as its backend counterpart lands. See
> [`/Plan.md`](../Plan.md) for the overall sequencing.
