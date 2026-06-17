# TripOtter

> A full-stack social platform for travelers — share journeys, join tribes, chat in real-time, and discover the world together.

**Version:** 0.9.0 · **Stack:** Next.js 15 · MongoDB · Socket.io · Sanity CMS · Google Gemini

---

## What Is TripOtter?

TripOtter is a travel-focused social network built with Next.js App Router. It combines the social graph of Instagram, the community structure of Reddit, and real-time messaging — purpose-built for the travel niche.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│                  HTTP :3000  │  WebSocket :10000             │
└──────────────────────┬───────┴──────────────┬───────────────┘
                       │                      │
          ┌────────────▼──────────┐  ┌────────▼───────────────┐
          │  trip-otter-dev       │  │  tripotter-pulse        │
          │  (Next.js — this repo)│  │  (NestJS microservice)  │
          └────────────┬──────────┘  └────────┬───────────────┘
                       │                      │
          ┌────────────▼──────────────────────▼───────────────┐
          │           Data Layer (Docker)                       │
          │   MongoDB :27017          Redis :6379 (pub/sub)    │
          └────────────────────────────────────────────────────┘
                       │
          ┌────────────▼──────────┐
          │  Sanity CMS            │  (media, shops, products)
          └───────────────────────┘
```

**This repository** is the Next.js monolith. It handles the UI, REST API routes, authentication, and all CRUD operations. The `tripotter-pulse` NestJS service (separate repo) manages WebSocket connections and Redis pub/sub for real-time features.

---

## Tech Stack

| Category | Technology |
|---|---|
| Framework | Next.js 15.2.4 (App Router) |
| Language | TypeScript |
| UI Library | React 19 |
| Styling | Tailwind CSS 3.4 + Shadcn/UI + Radix UI |
| Icons | Lucide React |
| Database | MongoDB via Mongoose ODM |
| Authentication | NextAuth v5 (Google OAuth + Credentials) |
| Real-time | Socket.io-client → tripotter-pulse |
| CMS | Sanity.io (media, shops, products) |
| AI | Google Gemini (`gemini-2.5-flash-lite-preview-06-17`) |
| Server State | TanStack React Query v5 |
| Client State | Zustand + Nanostores |
| Forms | React Hook Form + Zod |
| Rich Text Editor | Tiptap v3 |
| Email | Resend + Nodemailer |
| Image Processing | Sharp + HEIC2Any |
| NSFW Filtering | nsfwjs |
| Charts | Chart.js + react-chartjs-2 |
| Toasts | Sonner |
| Package Manager | **pnpm (required)** |

---

## Features

### Fully Implemented

| Feature | Description |
|---|---|
| Authentication | Email/password signup, Google OAuth, email verification, forgot password |
| Social Feed | Paginated post feed, user stories, suggested users |
| Posts | Create with images + caption + location + auto-extracted hashtags |
| Journals | Rich-text posts using the Tiptap editor |
| Comments | Add, edit, delete (rate-limited) |
| Likes | MongoDB transaction-safe like/unlike toggle |
| Followers | Follow/unfollow users, followers/following lists |
| User Profiles | Public profiles with posts, stats, cover/avatar editing |
| Global Search | Search users, tribes, shops, and hashtags |
| Tribes | Create, join, browse, and filter travel communities |
| Tribe Posts | Post to specific tribe feeds |
| Notifications | Real-time via WebSocket + notification center |
| Settings | Theme toggle, account settings |
| Shop | Sanity-powered shop and product listings |
| Media Upload | Drag-drop uploader with NSFW detection |
| Sanity Studio | CMS admin at `/api/media/studio` |
| Analytics | Chart.js platform stats dashboard |
| Reviews | Platform feedback and issue reporting |
| Static Pages | About, FAQ, Privacy, Terms, Press, Jobs, API docs |

### In Progress / Stubbed

| Feature | Status |
|---|---|
| Personalized Feed (v2) | `getPublicFeed_v2()` exists but incomplete — fails on empty tribes arrays |
| Chat | Page shell exists; message send/receive UI not yet built |
| Companions | Page exists; matching algorithm not implemented |
| Notification persistence | Real-time delivery works; DB persistence path unclear |
| Settings tabs | Notifications / Privacy / Business tabs are disabled (`opacity-50`) |
| Password reset flow | Uses hardcoded `localhost:10000` instead of `PULSE_BASE_URL` env var |
| Tribe creator population | `getTribeBySerial()` aggregation pipeline incomplete |

---

## Project Structure

```
trip-otter-dev/
├── app/                    # Next.js App Router — pages + API routes
│   ├── (routes)/           # Page routes (feed, tribes, shop, settings…)
│   ├── api/                # REST API handlers
│   │   ├── analytics/
│   │   ├── auth/           # NextAuth + signup + verification
│   │   ├── comment/
│   │   ├── companion/
│   │   ├── feed/
│   │   ├── followers/
│   │   ├── health/
│   │   ├── journey/
│   │   ├── locations/
│   │   ├── media/          # Sanity upload + Studio
│   │   ├── newsletter/
│   │   ├── posts/
│   │   ├── reaction/
│   │   ├── report/
│   │   ├── review/
│   │   ├── search/
│   │   ├── suggestion/
│   │   ├── tribe/
│   │   └── users/
│   └── misc/               # Static info pages
├── auth/                   # NextAuth configuration + providers
├── components/             # Reusable React components
│   ├── ui/                 # Shadcn/UI primitives
│   ├── feed/               # Feed-specific components
│   ├── tribes-page/        # Tribe feature components
│   ├── chat-page/          # Chat UI (WIP)
│   ├── richtext-editor/    # Tiptap integration
│   └── profile-page/       # Profile editing modals
├── data/                   # Static mock data
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, API client, DB helpers
│   ├── requests.ts         # All typed API client classes
│   ├── dbConnect.ts        # MongoDB connection with pooling
│   ├── useDB.ts            # DB operation wrapper (with transactions)
│   ├── gemini.ts           # Google Gemini AI client
│   ├── resend.ts           # Email service client
│   └── useWebsocket.ts     # Socket.io client hook
├── sanity/                 # Sanity CMS schema + client
├── styles/                 # Global CSS
├── types/                  # TypeScript interfaces
│   ├── user.d.ts
│   ├── post.d.ts
│   ├── tribes.d.ts
│   ├── chat.d.ts
│   └── …
└── utils/                  # Helpers + Mongoose schemas
    └── schema/             # All Mongoose schema definitions
```

---

## Quick Start

### Prerequisites

- **Node.js 20+** and **pnpm** (`npm install -g pnpm`)
- **Docker** for MongoDB and Redis

> **Do NOT use npm or yarn.** pnpm is required — other package managers will break the lockfile.

### 1. Start Infrastructure (Docker)

```yaml
# docker-compose.yml
services:
  mongo:
    image: mongo
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
  redis:
    image: redis
    restart: always
    ports:
      - "6379:6379"
volumes:
  mongo-data:
```

```bash
docker compose up -d
docker ps  # verify mongo (:27017) and redis (:6379) are running
```

### 2. Install Dependencies

```bash
pnpm install
```

If `bcrypt` or `sharp` crash (native binaries):

```bash
pnpm rebuild
```

### 3. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `AUTH_SECRET` | Yes | NextAuth signing secret (any random string) |
| `AUTH_GOOGLE_ID` | Yes* | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes* | Google OAuth client secret |
| `JWT_SECRET` | Yes | JWT signing secret |
| `GOOGLE_GENAI_API_KEY` | Yes | Google Gemini API key |
| `RESEND_API_KEY` | Yes | Resend email service key |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Yes | Sanity project ID |
| `NEXT_PUBLIC_SANITY_DATASET` | Yes | Sanity dataset (usually `production`) |
| `NEXT_PUBLIC_SANITY_API_TOKEN` | Yes | Sanity read/write token |
| `NEXT_PUBLIC_SANITY_API_VERSION` | No | Default: `2025-07-06` |
| `PULSE_BASE_URL` | Yes | `tripotter-pulse` server URL (server-side) |
| `NEXT_PUBLIC_PULSE_BASE_URL` | Yes | `tripotter-pulse` URL (client-side) |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | This app's API base URL |
| `NEXT_PUBLIC_WS_BASE_URL` | Yes | WebSocket server URL |

*Google OAuth optional for local dev — credentials login still works.

### 4. Run the App

```bash
pnpm dev
```

App available at [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Run tripotter-pulse

Real-time chat and notifications require the pulse NestJS service:

```bash
# In the tripotter-pulse repo
pnpm dev  # runs on port 10000
```

Without it, the app works fully except real-time WebSocket features.

---

## API Routes Reference

All routes live under `/app/api/`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user |
| PATCH | `/api/auth/signup` | Change password |
| POST | `/api/auth/verification` | Verify email token for password reset |
| GET | `/api/feed` | Get paginated public feed (`?page=&limit=&versionId=v1`) |
| GET | `/api/posts` | Get single post (`?postId=`) |
| POST | `/api/posts` | Create post |
| PATCH | `/api/posts` | Update post caption/location |
| DELETE | `/api/posts` | Delete post (`?id=`) |
| GET | `/api/comment` | Get post comments (`?postId=`) |
| POST | `/api/comment` | Add comment (rate-limited) |
| PATCH | `/api/comment` | Update comment |
| DELETE | `/api/comment` | Delete comment (`?id=`) |
| POST | `/api/reaction` | Toggle like on post |
| GET | `/api/users` | Get user profile (`?id=`) |
| PATCH | `/api/users` | Update user profile |
| GET | `/api/followers` | Get follow state |
| POST | `/api/followers` | Follow/unfollow user |
| GET | `/api/tribe` | List tribes (with filters) |
| POST | `/api/tribe` | Create tribe |
| PATCH | `/api/tribe` | Update tribe |
| DELETE | `/api/tribe` | Delete tribe |
| POST | `/api/tribe/join` | Join/leave tribe |
| GET | `/api/tribe/search` | Search tribes |
| GET | `/api/search` | Global search (`?profile=&group=&shop=&hashtags=`) |
| POST | `/api/media` | Upload image to Sanity |
| GET | `/api/locations` | Location search/autocomplete |
| POST | `/api/newsletter` | Subscribe to newsletter |
| POST | `/api/report` | Report content/user |
| POST | `/api/review` | Submit platform review |
| GET | `/api/analytics` | Platform analytics data |
| GET | `/api/health` | Service health check |

---

## Database Schemas (Mongoose)

| Schema | Key Fields |
|---|---|
| `User` | `email`, `username`, `fullName`, `password (hashed)`, `profileImage`, `coverImage`, `bio`, `location`, `socials[]`, `role`, `reputation` |
| `Post` | `image[]`, `caption`, `location`, `owner (ref User)`, `hashtags[]`, `postType (POST\|JOURNAL)`, `fromGroup (ref Tribe)`, `comments[]`, `likes[]` |
| `Comment` | `content`, `owner (ref User)`, `post (ref Post)` |
| `Like` | `user (ref User)`, `post (ref Post)` |
| `Tribe` | `name`, `description`, `category`, `tags[]`, `coverImage`, `profileImage`, `users[]`, `posts[]`, `createdBy`, `privacy (PUBLIC\|PRIVATE)` |
| `Profile` | `user`, `posts[]`, `comments[]`, `followers[]`, `following[]`, `likes[]` |
| `Notification` | `createdBy`, `receiver`, `content`, `type`, `postUrl`, `isRead` |
| `Verification` | `token`, `user`, `expiresAt` |
| `Review` | Platform feedback entries |
| `Report` | `data`, `status`, `user` |
| `Newsletter` | `email`, `subscribedAt` |

---

## State Management

| Layer | Tool | What It Manages |
|---|---|---|
| Server state | TanStack React Query v5 | User data, posts, feed, comments, search results |
| Session | NextAuth | Auth session, JWT, user identity |
| Client (complex) | Zustand | Tiptap rich text editor content |
| Client (simple) | Nanostores | Tribe filter atoms (privacy, category, tags) |
| Component | React `useState` | UI toggles, modals, loading states |

---

## Authentication Flow

1. **Email signup** → POST `/api/auth/signup` → bcrypt hash → save User + Profile to MongoDB
2. **Email login** → NextAuth Credentials provider → bcrypt compare → JWT issued
3. **Google OAuth** → NextAuth Google provider → auto-create user if first login
4. **Session** → JWT stored in NextAuth session; `useSession()` exposes `id`, `serial`, `username`, `name`, `email`, `image`
5. **Password reset** → `/forgot-password` → POST to pulse service → email via Resend → verify token → PATCH password

---

## Troubleshooting

| Error | Solution |
|---|---|
| `bcrypt` or `sharp` crashes | Run `pnpm rebuild` to recompile native binaries |
| WebSocket connection refused | Start `tripotter-pulse` on port 10000 |
| ERESOLVE / lockfile error | Use **pnpm** — do not use npm or yarn |
| MongoDB connection refused | Verify Docker container is running on port 27017 |
| Sanity images not loading | Check `NEXT_PUBLIC_SANITY_PROJECT_ID` and dataset env vars |
| Google sign-in fails | Verify `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set |

---

## Contributing

1. Fork and clone the repo
2. Follow the Quick Start guide above
3. Use `pnpm dev` for hot-reload development
4. Run `pnpm lint` before committing
5. Open a PR with a clear description of changes
