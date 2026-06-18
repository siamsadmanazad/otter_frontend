# TripOtter

> A social platform for travelers — share journeys, join tribes, chat in real-time, and discover the
> world together.

**Version:** 0.9.0 · **Stack:** Next.js 15 · Supabase (Postgres · Auth · Realtime · Storage) ·
Google Gemini

> ### ⚠️ Rebuild in progress
> The original backend (MongoDB, NextAuth, the `tripotter-pulse` realtime service) is **gone** and is
> being **rebuilt from scratch on Supabase**. This README describes the **target** architecture.
> See [`/Plan.md`](../Plan.md) for the master plan and
> [`rework_frontend.md`](./rework_frontend.md) for the frontend re-wire guide. Sections marked
> _(rebuild)_ are being migrated; some flows are temporarily non-functional until the backend lands.

---

## What Is TripOtter?

TripOtter is a travel-focused social network built with the Next.js App Router. It combines the
social graph of Instagram, the community structure of Reddit, and real-time messaging — purpose-built
for the travel niche. One Supabase backend serves both the **web app** (this repo) and a planned
**Flutter** mobile client through a shared REST contract.

---

## System Architecture

```
        ┌──────────────┐        ┌──────────────────┐
        │  Web (Next)  │        │ Flutter (planned)│
        └──────┬───────┘        └────────┬─────────┘
               │  REST (lib/requests.ts) │  REST (same contract)
               ▼                         ▼
        ┌──────────────────────────────────────────┐
        │   API layer — Next.js routes (/app/api)   │  ← business logic, JWT verify
        └───────────────────────┬───────────────────┘
                                │ service-role
                                ▼
        ┌──────────────────────────────────────────┐
        │                 SUPABASE                   │
        │  Postgres (RLS) · Auth · Realtime · Storage│
        └──────────────────────────────────────────┘

   Realtime: the browser subscribes DIRECTLY to Supabase Realtime channels (RLS-scoped).
   AI:       Google Gemini is called only from the API layer — keys never reach the client.
```

**This repository** is the Next.js web client plus the REST API layer that fronts Supabase. The
backend platform (database, auth, realtime, storage) is **Supabase**, fully managed. There is no
separate microservice and no Docker/Mongo/Redis to run.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15.2.4 (App Router) |
| Language | TypeScript |
| UI Library | React 19 |
| Styling | Tailwind CSS 3.4 + shadcn/UI + Radix UI |
| Icons | Lucide React |
| Database | **Supabase Postgres** (SQL migrations + Row-Level Security) _(rebuild)_ |
| Authentication | **Supabase Auth** (email/password + Google OAuth) _(rebuild)_ |
| Real-time | **Supabase Realtime** (channels) _(rebuild)_ |
| Media Storage | **Supabase Storage** (buckets + RLS + CDN) _(rebuild)_ |
| AI | Google Gemini (`gemini-2.5-flash-lite-preview-06-17`), server-side only |
| Server State | TanStack React Query v5 |
| Client State | Zustand + Nanostores |
| Forms | React Hook Form + Zod |
| Rich Text Editor | Tiptap v3 |
| Email | Resend |
| Image Processing | Sharp + HEIC2Any |
| NSFW Filtering | nsfwjs |
| Charts | Chart.js + react-chartjs-2 |
| Toasts | Sonner |
| Package Manager | **pnpm (required)** |

> **Removed from the old stack:** MongoDB/Mongoose, NextAuth/@auth/core, socket.io-client +
> `tripotter-pulse`, Sanity CMS, nodemailer, bcrypt/jsonwebtoken (auth now handled by Supabase).

---

## Features

### Built (UI complete — being re-wired to Supabase)

| Feature | Description |
|---|---|
| Authentication | Email/password signup, Google OAuth, email verification, password reset |
| Social Feed | Paginated post feed, user stories, suggested users |
| Posts | Create with images + caption + location + auto-extracted hashtags |
| Comments / Likes | Add/edit/delete comments; transaction-safe like toggle |
| Followers / Profiles | Follow/unfollow, followers/following lists, profile editing |
| Tribes | Create, join, browse, and filter travel communities; tribe feeds |
| Global Search | Users, tribes, shops, hashtags (Postgres full-text search) |
| Media Upload | Drag-drop uploader with NSFW detection → Supabase Storage |
| Static Pages | About, FAQ, Privacy, Terms, Press, Jobs, API docs |

### In progress / stubbed (Phase 2 of the rework)

| Feature | Status |
|---|---|
| Chat | Page shell exists; message send/receive UI to be built on Supabase Realtime |
| Companions | Page exists; AI matching (Gemini) to be implemented |
| Journals | Tiptap editor exists; submit currently not persisted |
| Notifications | Realtime delivery + persistence to be completed |
| Settings tabs | Notifications / Privacy / Business tabs currently disabled |

See [`rework_frontend.md`](./rework_frontend.md) for the phased plan to complete these.

---

## Project Structure

```
otter_frontend/
├── app/                    # Next.js App Router — pages + API routes
│   ├── (routes)/           # Page routes (feed, tribes, shop, settings, chat…)
│   ├── api/                # REST API handlers (front Supabase)  [rebuild]
│   └── misc/               # Static info pages
├── components/             # Reusable React components (KEEP)
│   ├── ui/                 # shadcn/UI primitives
│   ├── feed/ tribes-page/ chat-page/ richtext-editor/ profile-page/
├── hooks/                  # Custom React hooks
├── lib/
│   ├── requests.ts         # Typed REST client classes (KEEP surface)
│   ├── supabase/           # Supabase clients (browser / server / service-role)  [new]
│   ├── useWebsocket.ts     # Realtime hook (rebuilt on Supabase Realtime)
│   ├── gemini.ts           # Google Gemini client (server-side)
│   └── resend.ts           # Email client
├── styles/                 # Global CSS
├── types/                  # TypeScript interfaces (id-based shapes)
└── public/                 # Static assets
```

> Removed vs. the old stack: `utils/schema/` (Mongoose), `auth/index.ts` (NextAuth), `lib/mongo.ts`,
> `lib/dbConnect.ts`, `lib/useDB.ts`, `sanity/`, `lib/getSanityImage.ts`.

---

## Quick Start

### Prerequisites
- **Node.js 20+** and **pnpm** (`npm install -g pnpm`)
- A **Supabase project** (free tier is fine) — get the project URL and keys from the dashboard
- The **Supabase CLI** (for local DB migrations) — optional but recommended

> **Do NOT use npm or yarn.** pnpm is required — other package managers will break the lockfile.

### 1. Install dependencies
```bash
pnpm install
```
If `sharp` or native binaries crash, run `pnpm rebuild`.

### 2. Environment variables
```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (client-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key — **server only**, never exposed to the client |
| `GOOGLE_GENAI_API_KEY` | Yes | Google Gemini API key (server-side) |
| `RESEND_API_KEY` | Yes | Resend email key |
| `NEXT_PUBLIC_API_BASE_URL` | No | API base (defaults to same-origin `/api`) |

Google OAuth is configured in the **Supabase dashboard** (Auth → Providers), not via env vars here.

### 3. Database & storage
Apply the Postgres schema/migrations and create the Storage buckets defined in the backend guide
(`otter_backend/rework_backend.md`). With the Supabase CLI:
```bash
supabase link        # link to your project
supabase db push     # apply migrations
```

### 4. Run the app
```bash
pnpm dev
```
App available at [http://localhost:3000](http://localhost:3000). Realtime, auth, and storage are
served by your Supabase project — there is nothing else to run locally.

---

## API Routes Reference

All routes live under `/app/api/` and front Supabase. The client consumes them through the typed
classes in `lib/requests.ts`.

| Method | Route | Description |
|---|---|---|
| GET | `/api/feed` | Paginated feed (`?page=&limit=`) — public + personalized |
| GET/POST/PATCH/DELETE | `/api/posts` | Post CRUD (`?id=` for single) |
| GET/POST/PATCH/DELETE | `/api/comment` | Comment CRUD (rate-limited) |
| POST | `/api/reaction` | Toggle like (transaction-safe) |
| GET/PATCH | `/api/users` | Get/update user profile (`?id=`) |
| GET/POST | `/api/followers` | Follow state / toggle follow |
| GET/POST/PATCH/DELETE | `/api/tribe` | Tribe CRUD + filters |
| POST | `/api/tribe/join` | Join/leave tribe |
| GET | `/api/tribe/search` | Search tribes |
| GET | `/api/search` | Global search (`?profile=&group=&shop=&hashtags=`) |
| POST | `/api/media` | Upload image to Supabase Storage (NSFW-checked) |
| GET | `/api/locations` | Location search/autocomplete |
| GET/POST | `/api/companion` | AI companion matching (Gemini, server-side) |
| POST | `/api/newsletter` | Newsletter subscription |
| POST | `/api/report` · `/api/review` | Reports / reviews |
| GET | `/api/analytics` · `/api/health` | Analytics / health check |

Auth routes (`/api/auth/*`) are handled by **Supabase Auth**; the client uses the Supabase SDK behind
a `useSession`-compatible wrapper.

---

## Database Tables (Supabase Postgres)

The old Mongoose schemas map to Postgres tables (uuid `id` primary keys, `created_at`/`updated_at`,
foreign keys, and RLS policies). Defined in `otter_backend/rework_backend.md`.

| Table | Key columns |
|---|---|
| `users` / `profiles` | `id`, `serial`, `username`, `full_name`, `email`, `profile_image`, `cover_image`, `bio`, `location`, `socials`, `role`, `reputation` |
| `posts` | `id`, `images`, `caption`, `location`, `owner_id`, `hashtags`, `post_type`, `tribe_id`, `created_at` |
| `comments` | `id`, `content`, `owner_id`, `post_id` |
| `likes` | `id`, `user_id`, `post_id` |
| `tribes` | `id`, `name`, `description`, `category`, `tags`, `cover_image`, `profile_image`, `created_by`, `privacy` |
| `tribe_members` | `tribe_id`, `user_id` (join table) |
| `follows` | `follower_id`, `following_id` (join table) |
| `notifications` | `id`, `recipient_id`, `actor_id`, `type`, `target_type`, `target_id`, `read`, `created_at` |
| `conversations` / `messages` | chat (Phase 2) |
| `reviews` / `reports` / `newsletter` | platform feedback / moderation / subscriptions |

> Relationships that Mongoose handled via `populate` are now SQL joins; multi-row atomic operations
> (e.g. like toggle) are Postgres transactions or RPC functions.

---

## Authentication Flow (Supabase Auth)

1. **Email signup** → Supabase Auth creates the user; a `profiles` row is created on first sign-in.
2. **Email login** → Supabase password sign-in → session (JWT) stored in cookies via `@supabase/ssr`.
3. **Google OAuth** → Supabase social provider (configured in the dashboard).
4. **Session** → a `useSession`-compatible wrapper exposes `{ id, serial, username, name, email,
   image }` so existing components are unchanged.
5. **Password reset** → Supabase reset email → `/verify/[token]` → set new password.
6. **API authorization** → API routes verify the Supabase JWT before any write.

---

## Troubleshooting

| Error | Solution |
|---|---|
| `sharp` crashes | Run `pnpm rebuild` |
| ERESOLVE / lockfile error | Use **pnpm** — do not use npm or yarn |
| 401 / unauthorized on API | Check Supabase keys; confirm the session cookie is set (`@supabase/ssr`) |
| Images not loading | Verify the Supabase Storage bucket is public/policy-correct and the CDN host is in `next.config.mjs` `remotePatterns` |
| Google sign-in fails | Configure the Google provider in the Supabase dashboard (redirect URLs) |
| Realtime not updating | Confirm Realtime is enabled for the relevant tables/publications in Supabase |

---

## Contributing
1. Branch from `rework/supabase-rewire` (the active rebuild branch).
2. Follow [`rework_frontend.md`](./rework_frontend.md) — re-wire seams, don't change the UI in Phase 1.
3. Run `pnpm lint && pnpm tsc --noEmit && pnpm build` before committing.
4. Open a PR with a clear description and note which rework phase it belongs to.

---

## Related Docs
- [`/Plan.md`](../Plan.md) — master rebuild plan
- [`rework_frontend.md`](./rework_frontend.md) — frontend re-wire guide
- [`DOCUMENTATION.md`](./DOCUMENTATION.md) — in-depth technical reference
- `otter_backend/rework_backend.md` — Supabase backend build guide _(to be authored)_
