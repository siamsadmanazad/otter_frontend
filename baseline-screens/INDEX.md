# Visual Baseline — Phase 0 Step 1

Captured on the `rework/supabase-rewire` branch **before** any re-wire, to enforce the Prime Directive
("after Phase 1 the app looks identical"). See `rework_frontend.md` §4 Step 1 and §8 verification #6.

## How it works
- The committed baseline PNGs live in **`tests/visual/__screenshots__/`** (one per route × viewport).
- Diff against them anytime with: `pnpm test:visual`
- Re-baseline (Phase 0 only, or a DELIBERATE Phase 3 change): `pnpm test:visual:update`
- Config: `playwright.config.ts` · Spec: `tests/visual/baseline.spec.ts` · Chromium, viewports
  desktop 1440×900 and mobile 390×844.

## Routes captured now (11 × 2 = 22 snapshots)
These render correctly without the (dead) backend — they capture the design identity:

| Route | Notes |
|---|---|
| `/home` | Marketing landing (richest snapshot) |
| `/login`, `/signup`, `/forgot-password` | Auth forms |
| `/misc/about`, `/misc/faq`, `/misc/privacy-policy`, `/misc/terms-and-condition`, `/misc/press`, `/misc/jobs`, `/misc/api` | Static info pages |

## Routes deferred (need the Supabase backend + seed)
Auth-gated / data-driven routes error or hang without the backend, so they are intentionally **not**
baselined yet. Enable them in `tests/visual/baseline.spec.ts` (`DATA_ROUTES`) once the seed exists,
add an authenticated storage state, and run `pnpm test:visual:update`:

`/feed`, `/tribes`, `/tribes/[id]`, `/shop`, `/shop/[id]`, `/product/[id]`, `/companions`, `/chat`,
`/notifications`, `/settings`, `/settings/account-settings`, `/person/[id]`, `/post/[id]`, `/verify/[id]`,
`/misc/reviews`, `/misc/analytics`.

> **Rule:** during Phase 1, `pnpm test:visual` must stay green. Any unexpected diff is a regression.
