# Deploying TripOtter (web) to Vercel

The app is a standard Next.js 15 App Router project using **pnpm**. Vercel auto-detects
the framework; `vercel.json` pins the framework + pnpm commands explicitly. This guide
covers everything you do **once** in the Vercel + Supabase dashboards.

> Prereqs: a Vercel account, the GitHub repo `siamsadmanazad/otter_frontend`, and the
> hosted Supabase project `tripotter` (`oveptqgoyhpgvbdfqenf`).

---

## 1. Import the project
1. Vercel → **Add New… → Project** → import `siamsadmanazad/otter_frontend`.
2. Framework preset: **Next.js** (auto). Build/Install come from `vercel.json`
   (`pnpm build` / `pnpm install`). Leave the output directory default.
3. **Don't deploy yet** — set env vars first (step 2).

## 2. Environment variables
Add these under **Project → Settings → Environment Variables** (Production **and** Preview).

### Required
| Key | Value | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://oveptqgoyhpgvbdfqenf.supabase.co` | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (anon key) | public |
| `SUPABASE_SERVICE_ROLE_KEY` | (service role key) | **secret — server only** |
| `NEXT_PUBLIC_API_BASE_URL` | your Vercel prod URL, e.g. `https://tripotter.vercel.app` | the app calls its own `/api/*`; set to the deployed origin |

### Optional (features degrade gracefully if unset)
| Key | Purpose |
|-----|---------|
| `RESEND_API_KEY` | transactional email |
| `GOOGLE_GENAI_API_KEY` | Gemini (AI companions — deferred) |
| `MODERATION_API_URL` / `MODERATION_API_KEY` | server-side image moderation (fail-open if unset) |
| `SENTRY_DSN` | error reporting on 5xx — wired into `fail()` + feed/analytics + Flutter (no-op if unset) |

> The keys live in the gitignored local `.env.local`; copy the values from there. **Never**
> expose `SUPABASE_SERVICE_ROLE_KEY` to the client (no `NEXT_PUBLIC_` prefix — keep it that way).

### Not env-controlled (code constants — don't set as env vars)
- **Shop hidden:** `SHOP_ENABLED` is a hardcoded `false` in `lib/flags.ts` (not an env var). Flip
  it in code to re-enable Shop, not via Vercel env.
- **`NEXT_PUBLIC_API_URL`:** dead (only a commented line in `lib/requests.ts`). The live origin var
  is `NEXT_PUBLIC_API_BASE_URL` (above). No need to set the former.

### Flutter client (separate build, not Vercel env)
Provided at build time via `--dart-define`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`API_BASE_URL` (the deployed web origin), and optional `SENTRY_DSN`.

## 3. Supabase Auth redirect URLs
Supabase must allow the new origin or OAuth/magic-link/reset callbacks fail.
Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://<your-vercel-prod-domain>`
- **Redirect URLs (add all):**
  - `https://<your-vercel-prod-domain>/auth/callback`
  - `https://*-<your-vercel-scope>.vercel.app/auth/callback` (preview deploys)
- If **Google OAuth** is wanted: enable the Google provider in Supabase and add the
  Vercel domain to the Google Cloud OAuth client's authorized redirect URIs.

## 4. Image hosts
Already handled in `next.config.mjs` — Supabase Storage host is whitelisted (and also
derived from `NEXT_PUBLIC_SUPABASE_URL` at build, so it adapts if the project changes).
No action needed unless you add a new image CDN.

## 5. Deploy
Click **Deploy**. Build runs `pnpm build` (TypeScript errors **block** the build; ESLint
does not). First build ~2–4 min.

## 6. Post-deploy smoke checklist
On the production URL:
- [ ] Home/landing renders; no console errors.
- [ ] Sign in (`otter.demo+alice@tripotter.app` / `OtterDemo!2026`) → redirected to feed.
- [ ] Feed loads, images render from `*.supabase.co`.
- [ ] Create a post **with an image** → appears in feed (verifies Storage + service role).
- [ ] Like / comment / follow persist after refresh.
- [ ] Settings save (verifies hosted `profiles.preferences`).
- [ ] Notifications appear; open a second account and confirm realtime live-push.
- [ ] `/chat` two-user exchange works.

## 7. After going public
- Rotate the Supabase **DB password** (used for `supabase db push`).
- Restrict/rotate the `SUPABASE_SERVICE_ROLE_KEY` if it was ever shared.
- Consider enabling `SENTRY_DSN` for prod error visibility.

---

### Notes
- Root `trip_otter/` is **not** a repo; this file lives in `otter_frontend` so it ships
  with the deployable app.
- Backend (Supabase) is deployed separately via `supabase db push` from `otter_backend`.
