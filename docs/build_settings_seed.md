# Build Guide — Settings/Preferences (W5) + Seed Data (W7)

> **Created:** 2026-06-20 · **Owner:** soft-launch push. Companion to [`/gap.md`](./gap.md) (G5, G9, G11) +
> [`/currentplan.md`](./currentplan.md). **Format:** guidelines + ordered steps + copy-paste prompts — **no code snippets**.
> **Commit + push after every step.** Supabase: CLI 2.75 linked to `oveptqgoyhpgvbdfqenf`; **no Docker** → migrations
> apply **straight to hosted** (additive only, low-risk). Dev server runs at http://localhost:3000.

---

## 0. Index
- [1. Scope & principles](#1-scope--principles)
- [2. Data model decision](#2-data-model-decision)
- [3. Feature A — Settings & Preferences](#3-feature-a--settings--preferences-w5)
- [4. Feature B — Seed Data + hide Shop](#4-feature-b--seed-data--hide-shop-w7-g9-g11)
- [5. Execution order](#5-execution-order)
- [6. Verification matrix](#6-verification-matrix)
- [7. Rollback](#7-rollback)

---

## 1. Scope & principles
- **A (Settings):** turn the 3 dead cards (Notifications / Privacy / Business) into working, persisted preference
  forms; enforce the highest-value preference server-side (who-can-message) so it's real, not cosmetic.
- **B (Seed):** idempotent, realistic demo data (users, follows, posts incl. journals, tribes+members, a chat,
  notifications) so the app demos well + authed visual baselines exist. Plus hide Shop (dead/mock) + fix `product/[id]` uuid.
- **Robustness rules:** (1) additive migrations only, reversible. (2) every write authorized (owner/`auth.uid()`).
  (3) preferences are **merge-patched**, never blind-overwritten. (4) seed is **re-runnable** with no duplicates.
  (5) typed validation (Zod client + check constraints/defaults server). (6) verify each step (tsc + a live curl/click).

## 2. Data model decision
- Store preferences as a **single `preferences jsonb` column on `profiles`** (default `{}`), not a new table — keeps it
  on the row the session already loads, one RLS surface (the existing profiles owner-update policy already covers it),
  and merge-patch friendly. Shape (documented in the migration comment):
  - `notifications`: `{ likes, comments, follows, messages, mentions, email }` (all boolean, default true except email).
  - `privacy`: `{ profileVisibility: PUBLIC|FOLLOWERS|PRIVATE, whoCanMessage: EVERYONE|FOLLOWERS|NONE, showActivity: bool }`.
  - `business`: `{ isBusiness: bool, businessName, category, website, contactEmail }`.
- **Defaults** live in the API mapper (so old rows with `{}` read sensible values), not only in the DB.

---

## 3. Feature A — Settings & Preferences (W5)

### A1 — Backend migration (hosted)
> Goal: add the column + confirm owner-only RLS already applies. Additive, reversible.
```
In otter_backend, add a new timestamped migration that ALTERs public.profiles to add a `preferences jsonb not null
default '{}'::jsonb` column, with a comment documenting the notifications/privacy/business sub-shape. Do NOT add new
RLS — confirm the existing profiles UPDATE policy is owner-scoped (id = auth.uid()) so the column inherits it; if the
update policy is column-restricted, widen it to include preferences. Then apply to the linked hosted project. Since
Docker isn't available, push directly with the Supabase CLI (supabase db push --linked) OR, if auth/DB-password is
missing, STOP and ask the user for a fresh access token or DB password (do not guess). After applying, verify by
selecting preferences for one profile via the REST API. Commit + push the migration to otter_backend main.
```

### A2 — Settings API route
> Goal: one authorized read + merge-patch write of the caller's preferences.
```
In otter_frontend, add app/api/settings/route.ts: GET returns the authed user's preferences (profiles.preferences)
merged over the documented defaults (so {} reads as full defaults); PATCH deep-merges a partial { notifications?,
privacy?, business? } into the existing jsonb and returns the merged result. Auth via getServerUser/Bearer (401 otherwise).
Validate the body with Zod (enums for profileVisibility/whoCanMessage; booleans; trimmed strings). Add a SettingsAPI
(getPreferences/updatePreferences) + useSettingsApi singleton to lib/requests.ts in the existing class style. tsc clean. Commit.
```

### A3 — Three settings pages + enable cards
> Goal: real forms that load + save + reload, matching the existing settings card layout.
```
In otter_frontend, build app/settings/notifications, /privacy, /business pages (+ small _component.tsx client forms).
Reuse existing primitives (Switch for toggles, Select for enums, Input for business fields, RHF + Zod). Each form loads
current values via useSettingsApi.getPreferences (skeleton while loading), saves via updatePreferences with a Sonner
success/error toast, and reflects the saved state on reload. Gate the Business tab's editable fields behind the user's
role/isBusiness. In app/settings/page.tsx, convert the 3 dimmed divs (Notifications/Privacy/Business) into Links to the
new pages and REMOVE the opacity-50 grayscale cursor-not-allowed classes. Keep the page's visual structure. tsc clean. Commit.
```

### A4 — Enforce the one preference that matters server-side
> Goal: make a preference real, not cosmetic — robustness over breadth.
```
In otter_frontend, enforce privacy.whoCanMessage in the chat create route (app/api/chat/conversations POST): before
creating/returning a DIRECT conversation, read the target's preferences; if whoCanMessage is NONE, reject (403); if
FOLLOWERS, allow only when the caller follows the target (check follows). EVERYONE = allow. Return a clear error the
new-chat dialog can surface as a toast. Add a typed unit-style check via curl in the dev server. tsc clean. Commit.
```

**Feature A milestone:** the 3 tabs persist + reload; who-can-message is enforced on chat creation; no dimmed dead cards.

---

## 4. Feature B — Seed Data + hide Shop (W7, G9, G11)

### B1 — Seed script (idempotent, hosted via service-role)
> Goal: realistic demo data, safe to run repeatedly. No Docker → run against hosted with the service_role key.
```
In otter_backend (or otter_frontend/scripts), add a TypeScript seed script run with tsx that uses @supabase/supabase-js
with the SERVICE_ROLE key + project URL (read from otter_frontend/.env.local or env). It must be IDEMPOTENT: use
deterministic demo emails (e.g. otter.demo+alice@…) and skip-if-exists everywhere. Create ~8 demo auth users via
auth.admin.createUser (the handle_new_user trigger makes their profiles) with email_confirm true; then enrich profiles
(bio/location/avatar), create a follow graph, ~20 posts including a few postType=JOURNAL, 3 tribes with members and a
couple tribe posts, one DIRECT conversation with a few messages, and a handful of notifications. Print a summary + the
demo login credentials. Add an npm script "seed". Re-running must NOT duplicate. Document how to run it in the script header.
Commit to the repo (never commit real keys — read them from env).
```

### B2 — Run + verify seed
```
Run the seed script against hosted. Verify via the REST API / running app that demo users, posts (incl. journals),
tribes, the conversation, and notifications exist, and that a SECOND run reports "already exists" with zero new rows.
Capture one demo login for the user to try in the browser. Report the summary.
```

### B3 — Hide Shop + fix product route
```
In otter_frontend, feature-flag OFF the Shop for launch: hide the Shop entry in the nav/sidebar/bottom-nav and make
/shop + /shop/[id] redirect (or render a "coming soon") rather than show mock data — do NOT delete the code (fast-follow).
Fix app/product/[id] to treat ids as string/uuid (it currently parses integers). tsc clean. Commit.
```

### B4 — Re-baseline authed visuals (optional, if Playwright authed flow exists)
```
If a seeded/test account is wired into the Playwright auth setup, re-capture the authed visual snapshots against the
seed so future diffs are stable. Otherwise note it as pending. Commit any updated snapshots.
```

**Feature B milestone:** seed runs idempotently on hosted; app demos with real content; Shop hidden; product route uuid-safe.

---

## 5. Execution order
A1 → A2 → A3 → A4 → B1 → B2 → B3 (→ B4). Reason: stand up preferences end-to-end first (migration → API → UI → enforcement),
then seed (which can create demo preferences too), then the small shop/product cleanup. Each step = one commit; push after each.
If A1 hosted-apply is blocked on credentials, do A2/A3 against the column locally-typed and apply A1 the moment access is given
(forms will 500 until the column exists — acceptable, clearly flagged).

## 6. Verification matrix
| Step | Static | Runtime |
|---|---|---|
| A1 | migration parses | REST select returns `preferences` for a profile |
| A2 | tsc | curl GET/PATCH /api/settings (401 unauth; 200 authed merge) |
| A3 | tsc + visual | each tab saves → reload shows saved values |
| A4 | tsc | curl chat-create as non-follower vs follower vs EVERYONE |
| B1/B2 | tsx runs | 2nd run = 0 new rows; app shows seeded content |
| B3 | tsc | shop hidden; /product/[uuid] no longer int-parses |

## 7. Rollback
- A1: `alter table profiles drop column preferences;` (data is non-critical pref blob).
- B1: a `--purge` flag (or documented SQL) that deletes only the deterministic demo users (cascades clean their data).
- B3: flip the feature flag back on; no data change.
