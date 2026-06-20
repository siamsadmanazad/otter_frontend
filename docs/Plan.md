# TripOtter — Master Rebuild Plan

> **Status:** Active · **Created:** 2026-06-18
> **Situation:** The previous developer left the company and took the backend. The repo retains only
> the `otter_frontend` Next.js app. We are rebuilding the backend from scratch on **Supabase**,
> re-wiring the existing frontend to it **without changing how it looks**, and then building a
> **Flutter** client against the same backend.

---

## Table of Contents
1. [What Happened](#1-what-happened)
2. [Current State of the Repo](#2-current-state-of-the-repo)
3. [Frontend Tech-Stack Inventory (verified)](#3-frontend-tech-stack-inventory-verified)
4. [Stack Verdict — Keep or Replace?](#4-stack-verdict--keep-or-replace)
5. [Dead vs. Alive — The Rebuild Seam](#5-dead-vs-alive--the-rebuild-seam)
6. [Recommended Polished Stack (Supabase harmony)](#6-recommended-polished-stack-supabase-harmony)
7. [Target Architecture](#7-target-architecture)
8. [Workstreams & Sequencing](#8-workstreams--sequencing)
9. [Companion Documents](#9-companion-documents)
10. [Risk Register](#10-risk-register)
11. [Decision Log](#11-decision-log)

---

## 1. What Happened

The working product was a **Next.js 15 monolith** (`otter_frontend`) whose backend lived in three
places, all now non-functional:

- **`app/api/*` route handlers** — the REST API, written against MongoDB/Mongoose. Still present in
  the repo but coupled to infrastructure that no longer exists.
- **MongoDB + Mongoose schemas** (`utils/schema/`) — the database. The data and managed instance are
  gone.
- **`tripotter-pulse`** — a separate NestJS + Socket.io + Redis microservice for realtime/notifications.
  That repository was never part of this codebase and is gone.

The UI renders, but **every data, auth, realtime, and media path is dead.** This is effectively a
greenfield backend rebuild with a high-quality, salvageable frontend on top.

> **Important corollary:** An earlier analysis (the old MongoDB roadmaps, since removed) rejected
> Supabase *because "the backend already exists — don't rebuild it."* **That premise is dead.** When
> you're rebuilding from zero anyway, Supabase (one managed platform for Auth + Postgres + Realtime +
> Storage) is the right choice. `otter_backend/README.md` has been rewritten for this Supabase plan.

---

## 2. Current State of the Repo

| Folder | Reality |
|---|---|
| `otter_backend/` | **Docs only** — `README.md` (backend overview) + `rework_backend.md` (build guide). No code. (Old MongoDB roadmaps were removed.) |
| `otter_frontend/` | The Next.js app. Contains the **live UI** *and* the **dead backend** (`app/api`, Mongoose schemas, NextAuth, socket.io client). |
| `otter_flutter/` | **Empty stub** — only a README + .gitignore. Mobile app not started. |

---

## 3. Frontend Tech-Stack Inventory (verified)

Verified against `otter_frontend/package.json` and config files.

| Layer | Technology | Version | Assessment (2026) |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.2.4 | Modern ✅ |
| UI runtime | React | 19 | Modern ✅ |
| Language | TypeScript | 5.x | Modern ✅ |
| Styling | Tailwind CSS | 3.4.17 | Current ✅ (Tailwind 4 exists but 3.4 is fine) |
| Components | shadcn/ui + Radix UI (~27 pkgs) | latest | Modern ✅ |
| Icons | lucide-react | 0.454 | Modern ✅ |
| Server state | TanStack React Query | 5.83 | Modern ✅ |
| Client state | Zustand + Nanostores | 5.x / 1.x | Modern ✅ |
| Forms | React Hook Form + Zod | 7.60 / 3.25 | Modern ✅ |
| HTTP client | Axios (class wrapper in `lib/requests.ts`) | 1.10 | Fine ✅ |
| Rich text | Tiptap | 3.0 | Modern ✅ |
| Package manager | pnpm | — | Good ✅ |
| **Auth** | NextAuth + @auth/core | 4.24 / 0.40 | **Dead** — replace with Supabase Auth ❌ |
| **Database** | MongoDB via Mongoose | 8.16 | **Dead** — replace with Supabase Postgres ❌ |
| **Realtime** | socket.io-client → tripotter-pulse | 4.8 | **Dead** — replace with Supabase Realtime ❌ |
| **Media/CMS** | Sanity (`@sanity/*`, next-sanity) | 3.x | **Replace** with Supabase Storage (decision) ❌ |
| AI | Google Gemini (`@google/genai`) | 1.9 | Keep ✅ (server-side only) |
| Email | Resend (+ nodemailer) | 4.7 | Keep Resend; drop nodemailer |

### Health flags
- **~49 dependencies are pinned to `"latest"`** — a reproducibility / supply-chain risk. Pin all to
  explicit semver.
- **No ESLint or Prettier config.** `next.config.mjs` sets `eslint.ignoreDuringBuilds` and
  `typescript.ignoreBuildErrors` — errors are being masked at build time.
- **`next/image` optimization disabled** (`unoptimized: true`); no `remotePatterns`.
- Dead files present: `chat-page..old.tsx`, `tribes-page_v1.01.tsx`, empty `/test` page, `data/mocks/`.

---

## 4. Stack Verdict — Keep or Replace?

**Verdict: keep the frontend stack. It is modern and well-architected — not backdated.** A rewrite
would destroy real value (a clean component library, a single API abstraction, sensible state
management) for no benefit. The problem was never the frontend tech; it's that its backend is gone.

What we change is **surgical**, not a rewrite:
1. Pin all `"latest"` deps to explicit semver.
2. Add `@supabase/supabase-js` and `@supabase/ssr`.
3. Remove the dead-backend deps: `mongoose`, `socket.io-client`, `next-auth`, `@auth/core`,
   `bcrypt`, `bcryptjs`, `jsonwebtoken`, `@sanity/*`, `next-sanity`, `nodemailer`.
4. Add ESLint + Prettier; stop ignoring lint/TS errors on build once green.
5. Re-enable image optimization + add Supabase CDN to `remotePatterns`.
6. Delete dead files.

---

## 5. Dead vs. Alive — The Rebuild Seam

The codebase has a **clean seam**: client funnels through three abstractions, so ~95% of components
never change.

### KEEP (UI / client — mostly untouched)
- `components/**` — all React UI (shadcn/ui primitives, feed, tribes, chat shell, profile, editor).
- `app/**/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx` — pages & routing.
- `hooks/**`, `styles/**`, `public/**` — UI hooks, CSS, assets.
- `lib/requests.ts` — **keep the class API surface**; rebuild its HTTP targets only.
- `lib/useWebsocket.ts` — **keep the hook surface**; rebuild internals on Supabase Realtime.
- `types/**` — keep, with a `_id → id` shape rename.

### REBUILD (backend — all of it)
- `app/api/**/route.ts` (24 handlers) — rebuild against Supabase.
- `lib/mongo.ts`, `lib/useDB.ts`, `lib/dbConnect.ts` — replace with Supabase server client.
- `utils/schema/**` (Mongoose) — replace with Postgres tables + migrations + RLS.
- `auth/index.ts` (NextAuth) — replace with Supabase Auth.
- `lib/getSanityImage.ts`, `lib/sanity.ts`, `sanity/**` — replace with Supabase Storage helpers.
- `tripotter-pulse` — gone; superseded by Supabase Realtime.

### Data-shape change
MongoDB `_id` (ObjectId) → Postgres `id` (uuid). Mostly a mechanical rename in `types/*` and the
handful of components that read `._id` (e.g. `person-page.tsx`, `post-container.tsx`).

---

## 6. Recommended Polished Stack (Supabase harmony)

| Concern | Before (dead) | After (Supabase-harmonized) |
|---|---|---|
| Database | MongoDB / Mongoose | **Supabase Postgres** (SQL migrations, RLS) |
| Auth | NextAuth + bcrypt + JWT | **Supabase Auth** (email/password + Google OAuth, JWT) |
| Realtime | socket.io-client + pulse + Redis | **Supabase Realtime** (channels, RLS-scoped) |
| Media | Sanity CMS + CDN | **Supabase Storage** (buckets + RLS + CDN) |
| Server access | Mongoose models | **`@supabase/supabase-js` service-role** in API routes; `@supabase/ssr` for cookie/session |
| Email | Resend (+ nodemailer) | **Resend** (drop nodemailer) |
| AI | Gemini (mixed) | **Gemini, server-side only** (no client keys) |
| Search | Mongo regex / planned Atlas Search | **Postgres FTS / `pg_trgm`** (or Postgres `tsvector`) |
| NSFW | nsfwjs | nsfwjs (unchanged) |
| Hosting | Vercel + Docker Mongo/Redis + pulse VPS | **Vercel (web) + Supabase (managed)** |

Frontend keeps: Next.js, React 19, Tailwind, shadcn/ui, Radix, TanStack Query, Zustand, Nanostores,
RHF + Zod, Tiptap, Sonner, lucide.

---

## 7. Target Architecture

```
        ┌──────────────┐        ┌──────────────────┐
        │  Web (Next)  │        │  Flutter client  │
        └──────┬───────┘        └────────┬─────────┘
               │  REST (lib/requests.ts) │  REST (same contract)
               ▼                         ▼
        ┌──────────────────────────────────────────┐
        │   API layer: Next.js routes / Edge Fns    │  ← business logic, auth verify
        └───────────────────────┬───────────────────┘
                                │  service-role
                                ▼
        ┌──────────────────────────────────────────┐
        │                 SUPABASE                  │
        │  Postgres (RLS) · Auth · Realtime · Storage│
        └──────────────────────────────────────────┘

   Realtime: clients subscribe DIRECTLY to Supabase Realtime channels (RLS-scoped).
   AI:       Gemini called only from the API layer (keys never reach a client).
```

Key properties:
- **One REST contract** serves web and Flutter — no duplicated backend, no GraphQL.
- **Auth** is Supabase across both clients; the web keeps a `useSession`-compatible wrapper so UI
  code is untouched.
- **Realtime** is the one client-direct path (websockets), consistent for both clients.

---

## 8. Workstreams & Sequencing

| # | Workstream | Output | Depends on |
|---|---|---|---|
| A | **Supabase backend build** — project, Postgres schema + RLS, Auth, Storage buckets, rebuild `app/api/*`, Edge Functions for complex ops | working REST API on Supabase | — |
| B | **Frontend re-wire (P1)** — auth/data/realtime/media seams; look identical | app runs on Supabase, visually unchanged | A (per-endpoint) |
| C | **Finish stubs (P2)** — chat, companions, journals, settings tabs, notification persistence | feature-complete web app | B |
| D | **UI/UX polish (P3)** — states, a11y, image optimization, micro-interactions | production-grade polish | C |
| E | **Flutter client** — second REST consumer + Supabase Auth/Realtime | mobile app | A stable contract |

Sequencing note: A and B interleave endpoint-by-endpoint (rebuild a route in A, re-wire its caller in
B, verify, move on). C/D/E follow once the core is green.

---

## 9. Companion Documents

| Doc | Path | Purpose | Status |
|---|---|---|---|
| **This plan** | `/Plan.md` | Master strategy | ✅ written |
| **Frontend rework guide** | `otter_frontend/rework_frontend.md` | Step-by-step + CLI prompts to re-wire the frontend (Workstreams B/C/D) | ✅ written |
| **Frontend docs (reworked)** | `otter_frontend/DOCUMENTATION.md` | Technical reference for the post-rebuild architecture | ✅ reworked |
| **Frontend README (reworked)** | `otter_frontend/README.md` | Project overview + quick start for the new stack | ✅ reworked |
| **Backend build guide** | `otter_backend/rework_backend.md` | Supabase schema + RLS + Auth + Storage + RPC + API rebuild + Realtime + AI (Workstream A) | ✅ written |
| **Flutter build guide** | `otter_flutter/flutter_plan.md` | Mobile client against the REST contract (Workstream E) | ⏭️ **next doc to write** |

> **Backend docs consolidated (one source of truth):** `otter_backend/README.md` is now the single
> backend overview (strategy, decisions, costs, risks). `otter_backend/rework_backend.md` is the single
> build guide (its §16 Engineering Standards absorbed the useful security/perf/observability/testing
> content from the old meta-prompt). The old MongoDB roadmap and meta-prompt files have been **deleted**.
> None of the old MongoDB/"reject Supabase" guidance remains.

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Auth migration breaks session shape used across ~15 components | High | High | Preserve a `useSession`-compatible wrapper; re-wire behind it so components don't change |
| RLS policies wrong → data leakage or lockout | Medium | Critical | Service-role only in server routes; write RLS tests; default-deny then open per-table |
| Realtime parity with old socket.io behavior | Medium | Medium | Keep `useWebsocket` hook surface; verify each consumer (notifications, chat, presence) |
| Media migration (Sanity → Supabase Storage) breaks image URLs | Medium | Medium | Abstract via a single image helper; re-point URLs in one place; keep `nsfwjs` |
| Two clients drift on the REST contract | Medium | High | Freeze a versioned contract (`/api/v1`); publish an OpenAPI spec for Dart codegen |
| `"latest"` deps drift unexpectedly | High | Medium | Pin all to explicit semver in Phase 0 |
| Build masks errors (`ignoreBuildErrors`) | High | Medium | Add ESLint/Prettier; remove the ignore flags once green |
| Gemini key leakage | Low | High | Server-side only; never ship a key to web/Flutter |

---

## 11. Decision Log

1. **Rebuild backend on Supabase** (not MongoDB, not a self-hosted service). Premise that blocked
   Supabase before (existing backend) is void after the betrayal.
2. **Keep the REST seam.** Rebuild backend as Next.js API routes / Edge Functions behind
   `lib/requests.ts`; both clients share one REST contract. *(Chosen over direct supabase-js from the
   client for lower frontend churn and a single contract for web + Flutter.)*
3. **Media → Supabase Storage.** Drop Sanity to consolidate on one backend.
4. **Scope = re-wire + finish stubs + polish**, phased (P1 identical look → P2 stubs → P3 polish).
5. **Keep the frontend stack**; apply surgical upgrades only.
6. **Supabase Auth** replaces NextAuth (serves web + Flutter with one identity store).

> Next action: execute the build — `otter_backend/rework_backend.md` (Supabase backend) interleaved
> with `otter_frontend/rework_frontend.md` (frontend re-wire), endpoint by endpoint.
