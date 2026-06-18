# TripOtter — Technical Documentation

> In-depth technical reference for the TripOtter Next.js web client and its **Supabase** backend.

> ### ⚠️ Reflects the post-rebuild (Supabase) architecture
> The original backend (MongoDB, Mongoose, NextAuth, the `tripotter-pulse` Socket.io service) was
> lost and is being **rebuilt on Supabase**. This document describes the **target** architecture, not
> the dead one. Companion docs: [`/Plan.md`](../Plan.md) (master plan),
> [`rework_frontend.md`](./rework_frontend.md) (frontend re-wire), and
> `otter_backend/rework_backend.md` (backend build — to be authored). Items marked _(rebuild)_ are in
> migration.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Authentication System](#authentication-system)
4. [Database Layer](#database-layer)
5. [API Reference](#api-reference)
6. [State Management](#state-management)
7. [Real-time System](#real-time-system)
8. [Media & File Handling](#media--file-handling)
9. [AI Integration](#ai-integration)
10. [Frontend — Pages & Components](#frontend--pages--components)
11. [Type Definitions](#type-definitions)
12. [Environment Variables](#environment-variables)
13. [Incomplete Features & Recommended Paths](#incomplete-features--recommended-paths)
14. [Deployment Guide](#deployment-guide)

---

## Architecture Overview

TripOtter is a **Next.js web client + a REST API layer that fronts Supabase**. Supabase is the managed
backend platform — Postgres (with Row-Level Security), Auth, Realtime, and Storage. A planned Flutter
client consumes the **same REST contract**, so there is one backend for two clients.

```
        Web (Next.js)            Flutter (planned)
             │  REST                  │  REST   (one shared contract)
             ▼                        ▼
   ┌──────────────────────────────────────────────┐
   │  API layer — Next.js routes (/app/api/*)      │  business logic + JWT verification
   └───────────────────────┬───────────────────────┘
                          │ service-role client
                          ▼
   ┌──────────────────────────────────────────────┐
   │   SUPABASE: Postgres (RLS) · Auth · Realtime · Storage   │
   └──────────────────────────────────────────────┘

   Realtime: clients subscribe DIRECTLY to Supabase Realtime channels (RLS-scoped).
   AI:       Gemini is called only from the API layer; keys never reach a client.
```

**Key architectural decisions:**
- **One REST contract** serves web and Flutter — no GraphQL, no duplicated backend.
- **Server-side data access** uses the Supabase service-role client inside `/app/api` routes; **RLS**
  is enforced as defense-in-depth and is the primary guard for any direct client/Realtime access.
- **Multi-row atomic operations** (e.g. the like toggle touching `posts`, `profiles`, `likes`) are
  Postgres **transactions** or **RPC functions**, replacing the old Mongoose transaction wrapper.
- **Auth** is Supabase Auth; a `useSession`-compatible wrapper keeps UI components unchanged.
- **Realtime** is the one client-direct path (websockets to Supabase), consistent across clients.

---

## Directory Structure

```
otter_frontend/
├── app/
│   ├── (auth pages)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── verify/[id]/page.tsx
│   ├── feed/page.tsx
│   ├── post/[id]/page.tsx
│   ├── person/[id]/page.tsx
│   ├── tribes/{page.tsx,[id]/page.tsx}
│   ├── shop/{page.tsx,[id]/page.tsx}
│   ├── product/[id]/page.tsx
│   ├── chat/page.tsx
│   ├── companions/page.tsx
│   ├── notifications/page.tsx
│   ├── settings/{page.tsx,account-settings/page.tsx}
│   ├── home/page.tsx
│   ├── misc/                         # Static pages
│   └── api/                          # REST API routes fronting Supabase  [rebuild]
│       ├── auth/…                    # thin helpers; identity handled by Supabase Auth
│       ├── posts, comment, reaction, followers, feed
│       ├── tribe/{route,join,search}
│       ├── users, search, media, locations
│       ├── companion, journey, notifications, suggestion
│       ├── newsletter, report, review, analytics, health
├── components/                       # React UI (KEEP)
│   ├── ui/                           # shadcn/UI primitives
│   ├── feed/ tribes-page/ chat-page/ richtext-editor/ profile-page/
│   ├── desktop-header.tsx desktop-sidebar.tsx
│   └── mobile/{mobile-header,mobile-navigation}.tsx
├── hooks/                            # Custom React hooks
├── lib/
│   ├── supabase/                     # browser / server / service-role clients  [new]
│   ├── requests.ts                   # typed REST client classes (KEEP surface)
│   ├── useWebsocket.ts               # Realtime hook (Supabase Realtime)
│   ├── gemini.ts                     # Gemini client (server-side)
│   ├── resend.ts                     # Resend email client
│   ├── rate-limiter.middleware.ts    # rate limiting
│   └── tiptap-utils.ts
├── styles/globals.css
├── types/                            # TypeScript interfaces (id-based)
└── utils/helpers/                    # misc utilities
```

> **Removed vs. the old stack:** `utils/schema/` (Mongoose), `auth/index.ts` (NextAuth),
> `lib/mongo.ts`, `lib/dbConnect.ts`, `lib/useDB.ts`, `sanity/`, `lib/getSanityImage.ts`,
> `lib/sanity.ts`.

---

## Authentication System

Identity is handled by **Supabase Auth** (replacing NextAuth + bcrypt + jsonwebtoken).

### Providers
- **Email / password** — Supabase password auth. A `profiles` row is created on first sign-in.
- **Google OAuth** — Supabase social provider, configured in the Supabase dashboard (Auth →
  Providers), including redirect URLs. No client secret lives in this repo.

### Sessions
- Sessions (JWT) are stored in cookies via **`@supabase/ssr`**, so both Server Components and Route
  Handlers can read the session.
- A **`useSession`-compatible wrapper** exposes the legacy session shape so existing components are
  untouched:
  - `{ id, serial, username, name, email, image }`

### Authorization patterns
- **Server (API routes):** verify the Supabase JWT / user via the server client before any write;
  unauthenticated requests get `401`. This replaces `getServerSession(authOptions)`.
- **Client (components):** the `useSession`-compatible hook; redirect to `/login` when unauthenticated.
- **Database:** RLS policies scope every table so that even direct/Realtime access cannot read or
  write rows a user shouldn't see.

### Password reset flow
1. User submits email at `/forgot-password` → Supabase sends a reset email (via the configured
   provider / Resend).
2. User clicks the link → `/verify/[token]` → sets a new password through Supabase Auth.

> The old hardcoded `localhost:10000` reset path and the `tripotter-pulse` dependency are **removed**.

---

## Database Layer

### Access
Server-side code uses the **Supabase clients** in `lib/supabase/`:
- a **browser client** (anon key) for client components and Realtime,
- a **server client** (`@supabase/ssr`, reads the session cookie) for Server Components / route auth,
- a **service-role client** used **only inside `/app/api` routes** for privileged writes.

Multi-row atomic operations (the like toggle, follow toggle, tribe membership changes) are implemented
as **Postgres transactions** or **RPC / Postgres functions**, replacing
`runDBOperationWithTransaction()`.

### Tables (replacing the Mongoose schemas)
Each former schema maps to a Postgres table with a uuid `id`, `created_at`/`updated_at`, foreign keys,
and RLS. Exact DDL lives in `otter_backend/rework_backend.md`.

**`users` / `profiles`** — identity + public profile
- `id (uuid)`, `serial`, `username (unique)`, `full_name`, `email (unique)`, `profile_image`,
  `cover_image`, `bio`, `location`, `socials (jsonb)`, `role (USER|BUSINESS)`, `reputation`,
  `agree_to_terms`, `active`, timestamps.

**`posts`**
- `id (uuid)`, `serial`, `images (text[])`, `caption`, `location`, `owner_id → users`,
  `hashtags (text[])` (extracted on insert via trigger/app logic), `post_type (POST|JOURNAL)`,
  `tribe_id → tribes (nullable)`, timestamps.

**`comments`** — `id`, `content`, `owner_id → users`, `post_id → posts`, timestamps.
**`likes`** — `id`, `user_id → users`, `post_id → posts` (unique on `(user_id, post_id)`).
**`follows`** — `follower_id → users`, `following_id → users` (composite PK).

**`tribes`**
- `id (uuid)`, `serial`, `name`, `description`,
  `category (JOURNEY|LOCATION|COMMUNITY|FOOD|BIKERS|CYCLISTS|LONG_TRAVEL|ABROAD)`, `tags (text[])`,
  `cover_image`, `profile_image`, `created_by → users`, `privacy (PUBLIC|PRIVATE)`, timestamps.

**`tribe_members`** — `tribe_id → tribes`, `user_id → users` (join table; replaces the embedded
`users[]`/`posts[]` arrays).

**`notifications`** — `id`, `recipient_id`, `actor_id`, `type`, `target_type`, `target_id`, `read`,
`created_at`, `read_at`.

**`conversations` / `messages`** — chat (Phase 2): participants, last message, read receipts,
soft delete.

**`reviews` / `reports` / `newsletter`** — platform feedback, moderation queue, subscriptions.

> Relationships Mongoose handled with `populate` are now **SQL joins**. Embedded arrays
> (`followers[]`, `tribe.users[]`, `post.likes[]`) become **join tables** for query-ability and RLS.

---

## API Reference

All routes live under `/app/api/` and front Supabase. Response shapes match what the UI already
consumes, with `_id` renamed to `id`.

### Authentication
Handled by **Supabase Auth** (sign-up, sign-in, OAuth, reset). The web client uses the Supabase SDK
behind the `useSession`-compatible wrapper; `/api/auth/*` retains only thin server helpers where
needed (e.g. post-sign-in profile bootstrap).

### Feed
| Method | Endpoint | Auth | Params | Description |
|---|---|---|---|---|
| GET | `/api/feed` | Optional | `?page=&limit=` | Public + personalized feed (followed users + joined tribes; falls back to public when the user follows nothing) |

### Posts
| Method | Endpoint | Auth | Body/Params | Description |
|---|---|---|---|---|
| GET | `/api/posts` | No | `?id=` | Single post + comments + likes |
| POST | `/api/posts` | Yes | `{ images[], caption, location, postType, tribeId? }` | Create post |
| PATCH | `/api/posts` | Yes | `{ id, caption?, location? }` | Update post |
| DELETE | `/api/posts` | Yes | `?id=` | Delete post |

### Comments
| Method | Endpoint | Auth | Body/Params | Description |
|---|---|---|---|---|
| GET | `/api/comment` | No | `?postId=` | Comments for a post |
| POST | `/api/comment` | Yes | `{ postId, content }` | Add comment (rate-limited) |
| PATCH | `/api/comment` | Yes | `{ id, content }` | Edit comment |
| DELETE | `/api/comment` | Yes | `?id=` | Delete comment |

### Reactions / Users / Followers
| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/reaction` | Yes | `{ postId }` | Toggle like (transaction/RPC) |
| GET | `/api/users` | No | `?id=` | User profile + stats |
| PATCH | `/api/users` | Yes | `{ bio?, location?, socials?, profileImage?, coverImage?, preferences? }` | Update profile/preferences |
| POST | `/api/followers` | Yes | `{ targetUserId }` | Toggle follow |
| GET | `/api/followers` | No | `?id=` | Follow state / lists |

### Tribes
| Method | Endpoint | Auth | Body/Params | Description |
|---|---|---|---|---|
| GET | `/api/tribe` | Yes | `?filter=joined\|created\|notJoined&page=&limit=` | List tribes |
| GET | `/api/tribe` | Yes | `?serial=` | Tribe by serial (returns populated creator) |
| GET | `/api/tribe` | Yes | `?member=true&serial=&page=` / `?posts=true&serial=&page=` | Members / posts (paginated) |
| POST/PATCH/DELETE | `/api/tribe` | Yes | tribe fields | Create / update / delete |
| POST | `/api/tribe/join` | Yes | `{ serial }` | Join or leave |
| GET | `/api/tribe/search` | Yes | `?q=` | Search tribes |

### Search / Media / Other
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/search` | No | Multi-target search (`?profile=&group=&shop=&hashtags=`) via Postgres FTS |
| POST | `/api/media` | Yes | Upload image to Supabase Storage (NSFW-checked); returns CDN URL |
| GET | `/api/locations` | No | Location autocomplete |
| GET/POST | `/api/companion` | Yes | AI companion matching (Gemini, server-side) |
| POST | `/api/newsletter` `/api/report` `/api/review` | mixed | Subscriptions / moderation / feedback |
| GET | `/api/analytics` `/api/health` | mixed | Analytics / health |

---

## State Management

Unchanged from before — these layers are client-side and survive the backend swap.

| Layer | Tool | Manages |
|---|---|---|
| Server state | TanStack React Query v5 | API data: users, posts, feed, comments, search |
| Session | Supabase Auth (via `useSession`-compatible wrapper) | Auth session, user identity |
| Client (complex) | Zustand | Tiptap rich-text editor content |
| Client (simple) | Nanostores | Tribe filter atoms (privacy, category, tags) |
| Component | React `useState` | UI toggles, modals, loading states |

React Query usage (query keys, mutations with `invalidateQueries`) is unchanged; only the functions
inside `lib/requests.ts` change to hit the Supabase-backed routes.

---

## Real-time System

Realtime is provided by **Supabase Realtime** (replacing socket.io + `tripotter-pulse` + Redis).

```
Browser ──WebSocket──► Supabase Realtime
                          │  (Postgres changes / broadcast / presence)
                          ▼
                     RLS-scoped channels
```

- The browser subscribes **directly** to Supabase Realtime channels; access is scoped by RLS.
- `lib/useWebsocket.ts` keeps its **exported hook surface** so consumers
  (`message-container`, `notification-container`, `person-page`, `follow-button`, `post-container`,
  `useChatLogic`) are unchanged.
- Old socket events map to Supabase mechanisms:

| Old socket event | New mechanism |
|---|---|
| `notification` (S→C) | subscription to `notifications` inserts for the recipient |
| `createNotification` (C→S) | API write → row insert → Realtime fan-out |
| `message` (both) | `messages` table changes / per-conversation channel |
| `joinRoom` | subscribe to a `private-conversation-{id}` channel |

> All `NEXT_PUBLIC_WS_BASE_URL` / `PULSE_BASE_URL` references and the dev-tunnel fallback are removed.

---

## Media & File Handling

Media moved from Sanity to **Supabase Storage**.

### Upload flow
1. User selects a file via `react-dropzone`.
2. **NSFW check** via `nsfwjs` — aborts if flagged.
3. HEIC files converted to JPEG via `heic2any`.
4. Upload to a Supabase Storage bucket (direct signed-URL upload, or `POST /api/media`).
5. The public/CDN URL is stored on the relevant row (`posts.images`, `users.profile_image`, etc.).

### Buckets & policies
- Suggested buckets: `avatars`, `covers`, `posts` — each with RLS policies (public read where
  appropriate; writes scoped to the owning user). Defined in `otter_backend/rework_backend.md`.

### Rendering
- A single Supabase image-URL helper replaces `getSanityImage`. `next/image` optimization is
  **re-enabled**, with the Supabase Storage CDN host added to `next.config.mjs` `remotePatterns`.

> The Sanity Studio route and Sanity-sourced shop/product content are removed; that content is sourced
> from Postgres (or kept static pending Phase 2).

---

## AI Integration

### Google Gemini (`lib/gemini.ts`)
- Model: `gemini-2.5-flash-lite-preview-06-17`.
- **Called only from server code** (API routes / server actions). The API key is never shipped to the
  web bundle or to Flutter.
- Used by: `/api/companion` (travel companion matching), `/api/suggestion` (content suggestions), and
  the `/companions` experience.

---

## Frontend — Pages & Components

### Page inventory
| Route | Auth | Description |
|---|---|---|
| `/` | No | Redirects to `/feed` (authed) or `/home` |
| `/home` | No | Marketing landing |
| `/feed` | Yes | Main social feed |
| `/post/[id]` | No | Post detail + comments |
| `/person/[id]` | Partial | User profile |
| `/tribes`, `/tribes/[id]` | Yes | Tribe discovery / detail |
| `/shop`, `/shop/[id]`, `/product/[id]` | No | Shop & products (uuid ids) |
| `/chat` | Yes | Chat (Phase 2) |
| `/companions` | Yes | AI companions (Phase 2) |
| `/notifications` | Yes | Notification center |
| `/settings`, `/settings/account-settings` | Yes | Settings hub / account |
| `/login`, `/signup`, `/forgot-password`, `/verify/[id]` | No | Auth |
| `/misc/*` | No | About, FAQ, Privacy, Terms, Press, Jobs, API, Analytics, Reviews |

### Key reusable components
- **Layout:** `LayoutProviders` (Theme + React Query + Supabase session provider + nav),
  `DesktopSidebar`, `DesktopHeader`, `MobileNavigation`.
- **Feed:** `PostContainer`, `CreatePost`, `UserStories`, `SuggestedUsers`.
- **Social:** `FollowButton`, `FollowModal`, `ProfileEditModal`, `SearchModal` (⌘K).
- **Tribes:** `TribesPage`, `TribePage`, `TribeMemberButton`.
- **Editor:** `RichTextEditor` (Tiptap) for journals/long-form.

> Components are **not** modified by the backend swap except for the mechanical `._id → .id` rename
> and the auth-call updates on the auth pages.

---

## Type Definitions

Located in `/types/`. The primary change from the old stack is **`_id` → `id`** (Mongo ObjectId →
Postgres uuid) and array-relationship fields becoming id lists / joined objects.

- `UserDocument` — `id`, `serial`, `username`, `full_name`/`fullName`, `email`, `profile_image`,
  `cover_image`, `bio`, `location`, `socials[]`, `role`, `reputation`, `active`, timestamps.
- `PostDocument` — `id`, `serial`, `images[]`, `caption`, `location`, `owner`, `hashtags[]`,
  `post_type`, `tribe_id?`, `comments[]`, `likes[]`, timestamps.
- `TribeDocument` — `id`, `serial`, `name`, `description`, `category`, `tags[]`, `cover_image`,
  `profile_image`, `created_by`, `privacy`, `usersCount`, `postsCount`.

> **Convention (locked):** the API returns **camelCase** (matching the existing `types/*` and
> components); Postgres `snake_case` columns are mapped to camelCase in the route/RPC layer. The only
> renamed identifier is `_id → id`; `serial` is preserved. See `rework_frontend.md` §2 "Data-shape
> contract".

---

## Environment Variables

`.env.local` reference for the web client:

```env
# ── Supabase ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL="https://<your-project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-public-key>"      # client-safe
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"          # SERVER ONLY — never expose

# ── AI & Email ────────────────────────────────────────────────────────────────
GOOGLE_GENAI_API_KEY="<gemini-api-key>"                 # server-side only
RESEND_API_KEY="re_<resend-key>"

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"    # optional; defaults to same-origin
```

> **Removed:** `MONGODB_URI`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `JWT_SECRET`,
> all `NEXT_PUBLIC_SANITY_*`, `PULSE_BASE_URL`, `NEXT_PUBLIC_PULSE_BASE_URL`, `NEXT_PUBLIC_WS_BASE_URL`.
> Google OAuth credentials live in the **Supabase dashboard**, not here.
>
> `NEXT_PUBLIC_*` vars are baked into the client bundle at build time. The service-role key must
> **never** carry that prefix.

---

## Incomplete Features & Recommended Paths

Full step-by-step plans (with CLI prompts) are in [`rework_frontend.md`](./rework_frontend.md)
(Phase 2). Summary:

1. **Chat** — build `MessageInput`/`MessageThread`/`ConversationList` on the chat shell; persist
   `conversations`/`messages`; deliver via Supabase Realtime per-conversation channels.
2. **Companions** — preference form → `/api/companion` → Gemini (server-side) ranking → results with
   Connect/Chat CTAs; rate-limited.
3. **Journals** — wire the Tiptap submit to the posts API (`post_type = JOURNAL`); currently only
   logs to console.
4. **Settings tabs** — remove `opacity-50 pointer-events-none`; persist preferences via `/api/users`.
5. **Notifications** — complete persistence + pagination + mark-read; keep realtime prepend/badge.
6. **Feed v2 / tribe creator / product ids** — re-implemented correctly during the Phase 1 data
   re-wire (empty-array guard; populated creator; uuid product ids).

---

## Deployment Guide

### Web (Vercel — recommended)
1. Push to GitHub; import the project in Vercel.
2. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_GENAI_API_KEY`, `RESEND_API_KEY`.
3. Add the Supabase Storage CDN host to `next.config.mjs` `remotePatterns` (already done in the rework).
4. Deploy. There is **no** separate realtime service, Docker Mongo, or Redis to run.

### Backend (Supabase — managed)
1. Create the Supabase project; apply migrations (`supabase db push`) and Storage buckets/policies
   from `otter_backend/rework_backend.md`.
2. Configure Auth providers (email + Google) and redirect URLs in the dashboard.
3. Enable Realtime on the tables that need it (e.g. `notifications`, `messages`).

### Notes
- Keep the **service-role key** server-only (Vercel env, not `NEXT_PUBLIC_`).
- RLS must be **on** for every table before going live — it is the primary guard for any direct
  client/Realtime access.
- Set Supabase Auth redirect URLs to your production domain.

---

## Related Docs
- [`/Plan.md`](../Plan.md) — master rebuild plan
- [`README.md`](./README.md) — project overview & quick start
- [`rework_frontend.md`](./rework_frontend.md) — frontend re-wire guide
- `otter_backend/rework_backend.md` — Supabase backend build guide _(to be authored)_
