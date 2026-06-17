# TripOtter — Technical Documentation

> In-depth technical reference for the `trip-otter-dev` Next.js monolith.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Authentication System](#authentication-system)
4. [Database Layer](#database-layer)
5. [API Reference](#api-reference)
6. [State Management](#state-management)
7. [Real-time System (WebSocket)](#real-time-system)
8. [Media & File Handling](#media--file-handling)
9. [AI Integration](#ai-integration)
10. [Frontend — Pages & Components](#frontend--pages--components)
11. [Type Definitions](#type-definitions)
12. [Environment Variables](#environment-variables)
13. [Incomplete Features & Recommended Paths](#incomplete-features--recommended-paths)
14. [Deployment Guide](#deployment-guide)

---

## Architecture Overview

TripOtter uses a **Next.js monolith** pattern — the frontend and REST API live in the same repository. A separate NestJS microservice (`tripotter-pulse`) handles stateful WebSocket connections.

```
Browser
  │
  ├── HTTP :3000 ──► Next.js App (this repo)
  │                    ├── App Router (React Server Components + Client Components)
  │                    ├── API Routes (/app/api/*)
  │                    ├── MongoDB via Mongoose
  │                    └── Sanity CMS (media, shops, products)
  │
  └── WebSocket :10000 ──► tripotter-pulse (NestJS — separate repo)
                              ├── Socket.io server
                              ├── MongoDB (shared instance)
                              └── Redis pub/sub :6379
```

**Key Architectural Decisions:**

- All database writes go through `lib/useDB.ts` which wraps Mongoose operations in a try/catch and handles connection reuse.
- Multi-document operations (e.g. like toggle updates User, Post, and Profile simultaneously) use `runDBOperationWithTransaction()` for atomicity.
- Public-facing Next.js API routes validate sessions using `getServerSession(authOptions)` before any write operation.
- Rate limiting is implemented in `lib/rate-limiter.middleware.ts` and applied to comment creation.

---

## Directory Structure

```
trip-otter-dev/
├── app/
│   ├── (auth pages)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── verify/[id]/page.tsx
│   ├── feed/page.tsx
│   ├── post/[id]/page.tsx
│   ├── person/[id]/page.tsx
│   ├── tribes/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── shop/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── product/[id]/page.tsx
│   ├── chat/page.tsx
│   ├── companions/page.tsx
│   ├── notifications/page.tsx
│   ├── settings/
│   │   ├── page.tsx
│   │   └── account-settings/page.tsx
│   ├── home/page.tsx
│   ├── misc/                        # Static pages
│   │   ├── about/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── api/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── jobs/page.tsx
│   │   ├── press/page.tsx
│   │   ├── privacy-policy/page.tsx
│   │   ├── reviews/page.tsx
│   │   └── terms-and-condition/page.tsx
│   ├── test/page.tsx               # Empty dev page
│   └── api/
│       ├── analytics/route.ts
│       ├── auth/
│       │   ├── [...nextauth]/route.ts
│       │   ├── signup/route.ts
│       │   └── verification/route.ts
│       ├── comment/route.ts
│       ├── companion/route.ts
│       ├── feed/
│       │   ├── route.ts
│       │   └── feed.action.ts      # Server actions for feed
│       ├── followers/route.ts
│       ├── health/route.ts
│       ├── journey/route.ts
│       ├── locations/route.ts
│       ├── media/
│       │   ├── route.ts
│       │   └── studio/[[...tool]]/route.ts
│       ├── newsletter/route.ts
│       ├── posts/route.ts
│       ├── reaction/route.ts
│       ├── report/route.ts
│       ├── review/route.ts
│       ├── search/route.ts
│       ├── suggestion/route.ts
│       ├── tribe/
│       │   ├── route.ts
│       │   ├── tribe.action.ts     # Server actions for tribes
│       │   ├── join/route.ts
│       │   └── search/route.ts
│       └── users/route.ts
├── auth/
│   └── index.ts                    # NextAuth config (providers, callbacks, session)
├── components/
│   ├── layout-providers.tsx        # Root layout provider composition
│   ├── desktop-header.tsx
│   ├── desktop-sidebar.tsx
│   ├── mobile/
│   │   ├── mobile-header.tsx
│   │   └── mobile-navigation.tsx
│   ├── ui/                         # Shadcn/UI primitives
│   ├── feed/
│   │   ├── shared/user-stories/
│   │   └── …
│   ├── tribes-page/
│   │   ├── tribes-page_v1.01.tsx
│   │   └── tribe-page/tribe-page.tsx
│   ├── chat-page/chat-page.tsx
│   ├── richtext-editor/
│   └── profile-page/
├── data/                           # Mock/static data
├── hooks/                          # Custom React hooks
├── lib/
│   ├── dbConnect.ts                # MongoDB connection pool
│   ├── useDB.ts                    # Operation wrapper (transactions)
│   ├── mongo.ts                    # Alternate connection handler
│   ├── requests.ts                 # Typed API client classes
│   ├── gemini.ts                   # Gemini AI client
│   ├── resend.ts                   # Resend email client
│   ├── useWebsocket.ts             # Socket.io client hook
│   ├── getSanityImage.ts           # Sanity image URL builder
│   ├── rate-limiter.middleware.ts  # Rate limiting logic
│   └── tiptap-utils.ts             # Tiptap helper utilities
├── sanity/
│   ├── env.ts                      # Sanity env assertions
│   ├── lib/client.ts               # Sanity client
│   └── schemaTypes/                # Sanity content schemas
├── styles/
│   └── globals.css
├── types/                          # TypeScript interfaces
└── utils/
    ├── schema/                     # Mongoose schema definitions
    └── helpers/                    # Misc utility functions
```

---

## Authentication System

### Providers (`auth/index.ts`)

**Google OAuth:**
- Triggered via `signIn("google")`
- Auto-creates a new User + Profile document on first login
- Sets `username` from email prefix if not provided

**Credentials (Email/Password):**
- Triggered via `signIn("credentials", { email, password })`
- Looks up user by email in MongoDB
- Compares password with bcrypt
- Returns null on failure (shows error to user)

### JWT Session Payload

```typescript
{
  id: string;         // MongoDB _id
  serial: string;     // UUID serial
  username: string;
  name: string;
  email: string;
  image: string;      // Profile image URL
}
```

### Session Validation Pattern

Server-side (API routes):
```typescript
const session = await getServerSession(authOptions);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

Client-side (React components):
```typescript
const { data: session, status } = useSession();
if (status === "unauthenticated") redirect("/login");
```

### Password Reset Flow

1. User submits email at `/forgot-password`
2. POST to `PULSE_BASE_URL/api/verification/` (tripotter-pulse)
3. Pulse sends email via Resend with a verification link
4. User clicks link → `/verify/[token]`
5. PATCH to `/api/auth/signup` with new password

**Known Issue:** The verification API call in `/app/api/auth/verification/route.ts` has a hardcoded `localhost:10000` fallback instead of using `PULSE_BASE_URL` consistently.

---

## Database Layer

### Connection Management (`lib/dbConnect.ts`, `lib/useDB.ts`)

```typescript
// Standard operation
const result = await runDBOperation(async () => {
  return await UserModel.findById(id);
});

// Multi-document atomic operation
const result = await runDBOperationWithTransaction(async (session) => {
  await PostModel.findByIdAndUpdate(postId, { $push: { likes: userId } }, { session });
  await ProfileModel.findOneAndUpdate({ user: userId }, { $push: { likes: postId } }, { session });
  await LikeModel.create([{ user: userId, post: postId }], { session });
});
```

Connection pooling is managed at module level; existing connections are reused across requests (important for serverless/Next.js environments).

### Mongoose Schemas (`utils/schema/`)

**User Schema:**
```typescript
{
  serial: string (UUID, unique),
  fullName: string,
  username: string (unique),
  email: string (unique),
  password: string (bcrypt hashed),
  profileImage: string (URL),
  coverImage: string (URL),
  bio: string,
  location: string,
  socials: [{ platform: string, url: string }],
  role: "USER" | "BUSINESS",
  reputation: number,
  agreeToTerms: boolean,
  active: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Post Schema:**
```typescript
{
  serial: string (UUID),
  image: string[],
  caption: string,
  location: string,
  owner: ObjectId (ref User),
  hashtags: string[],             // auto-extracted from caption on save
  postType: "POST" | "JOURNAL",
  fromGroup: ObjectId (ref Tribe),
  comments: ObjectId[] (ref Comment),
  likes: ObjectId[] (ref User),
  createdAt: Date,
  updatedAt: Date
}
```

**Tribe Schema:**
```typescript
{
  serial: string (UUID),
  name: string,
  description: string,
  category: "JOURNEY" | "LOCATION" | "COMMUNITY" | "FOOD" | "BIKERS" | "CYCLISTS" | "LONG_TRAVEL" | "ABROAD",
  tags: string[],
  coverImage: string,
  profileImage: string,
  users: ObjectId[] (ref User),
  posts: ObjectId[] (ref Post),
  createdBy: ObjectId (ref User),
  privacy: "PUBLIC" | "PRIVATE",
  createdAt: Date,
  updatedAt: Date
}
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/auth/signup` | No | `{ fullName, username, email, password }` | Create account |
| PATCH | `/api/auth/signup` | No | `{ email, password, token }` | Reset password |
| POST | `/api/auth/verification` | No | `{ email }` | Trigger password reset email |
| GET | `/api/auth/[...nextauth]` | — | — | NextAuth handler |

### Feed

| Method | Endpoint | Auth | Params | Description |
|---|---|---|---|---|
| GET | `/api/feed` | No | `?page=1&limit=10&versionId=v1` | Paginated public feed |

Feed v1 returns all non-tribe posts sorted by `createdAt`. Feed v2 (in progress) will filter by followed users and joined tribes.

### Posts

| Method | Endpoint | Auth | Body/Params | Description |
|---|---|---|---|---|
| GET | `/api/posts` | No | `?postId=` | Fetch single post with comments + likes |
| POST | `/api/posts` | Yes | `{ image[], caption, location, postType, fromGroup? }` | Create post |
| PATCH | `/api/posts` | Yes | `{ id, caption?, location? }` | Update post |
| DELETE | `/api/posts` | Yes | `?id=` | Delete post |

### Comments

| Method | Endpoint | Auth | Body/Params | Description |
|---|---|---|---|---|
| GET | `/api/comment` | No | `?postId=` | Get comments for a post |
| POST | `/api/comment` | Yes | `{ postId, content }` | Add comment (rate-limited) |
| PATCH | `/api/comment` | Yes | `{ id, content }` | Edit comment |
| DELETE | `/api/comment` | Yes | `?id=` | Delete comment |

### Reactions

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/reaction` | Yes | `{ postId }` | Toggle like (transaction-safe) |

### Users

| Method | Endpoint | Auth | Body/Params | Description |
|---|---|---|---|---|
| GET | `/api/users` | No | `?id=` | Get user profile + stats |
| PATCH | `/api/users` | Yes | `{ bio?, location?, socials?, profileImage?, coverImage? }` | Update profile |

### Followers

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/followers` | Yes | `{ targetUserId }` | Toggle follow/unfollow |

### Tribes

| Method | Endpoint | Auth | Body/Params | Description |
|---|---|---|---|---|
| GET | `/api/tribe` | Yes | `?filter=joined\|created\|notJoined&page=&limit=` | List tribes |
| GET | `/api/tribe` | Yes | `?serial=` | Get tribe by serial ID |
| GET | `/api/tribe` | Yes | `?member=true&serial=&page=` | Get tribe members (paginated) |
| GET | `/api/tribe` | Yes | `?posts=true&serial=&page=` | Get tribe posts (paginated) |
| POST | `/api/tribe` | Yes | `{ name, description, category, tags[], privacy, coverImage?, profileImage? }` | Create tribe |
| PATCH | `/api/tribe` | Yes | `{ serial, ...updates }` | Update tribe |
| DELETE | `/api/tribe` | Yes | `?serial=` | Delete tribe |
| POST | `/api/tribe/join` | Yes | `{ serial }` | Join or leave tribe |
| GET | `/api/tribe/search` | Yes | `?q=` | Search tribes |

### Search

| Method | Endpoint | Auth | Params | Description |
|---|---|---|---|---|
| GET | `/api/search` | No | `?profile=&group=&shop=&hashtags=` | Multi-target search |

### Media

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/api/media` | Yes | `FormData with file` | Upload image to Sanity, returns URL |

### Other Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ status: "ok" }` |
| GET | `/api/locations` | Location autocomplete (`?q=`) |
| POST | `/api/newsletter` | Email subscription |
| POST | `/api/report` | Report user or content |
| POST | `/api/review` | Submit platform review |
| GET | `/api/analytics` | Platform analytics data |
| GET/POST | `/api/companion` | Companion matching |
| GET/POST | `/api/journey` | Journey/trip tracking |
| GET | `/api/suggestion` | AI content suggestions |

---

## State Management

### TanStack React Query (Server State)

Used for all data that comes from the API and needs caching:

```typescript
// Example: fetching user profile
const { data: user, isLoading } = useQuery({
  queryKey: ["user", userId],
  queryFn: () => UserAPI.get(userId),
  staleTime: 5 * 60 * 1000,  // 5 minutes
});

// Example: mutation with optimistic update
const likeMutation = useMutation({
  mutationFn: () => ReactionAPI.toggle(postId),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["post", postId] }),
});
```

### Zustand (Rich Text Editor State)

```typescript
// lib/store/content-store.ts (approximate)
const useContentStore = create((set) => ({
  content: "",
  setContent: (content: string) => set({ content }),
}));
```

### Nanostores (Tribe Filter Atoms)

```typescript
import { filterTribeStore, setPrivacy, setCategory, addTag } from "@/lib/tribe-filter-store";

// Set a filter
setPrivacy("PUBLIC");
setCategory("JOURNEY");
addTag("hiking");

// Read in component
const filter = useStore(filterTribeStore);
```

### NextAuth Session

```typescript
// Server Component
import { getServerSession } from "next-auth";
const session = await getServerSession(authOptions);

// Client Component
import { useSession } from "next-auth/react";
const { data: session } = useSession();
// session.user.id, session.user.username, session.user.email
```

---

## Real-time System

### Architecture

```
Browser ──WebSocket──► tripotter-pulse (NestJS :10000)
                          │
                     Socket.io Server
                          │
                     Redis Pub/Sub (:6379)
                          │
                     MongoDB (shared)
```

### Client Hook (`lib/useWebsocket.ts`)

```typescript
const { socket, isConnected } = useWebsocket();

// Emit notification
socket.emit("createNotification", {
  receiver: targetUserId,
  type: "FOLLOW",
  content: "started following you",
});

// Listen for notifications
socket.on("notification", (data) => {
  // update notification state
});
```

The hook connects to `NEXT_PUBLIC_WS_BASE_URL` (falls back to a dev-tunnel URL if env is unset — `lib/useWebsocket.ts:15`).

### Events (Known)

| Event | Direction | Description |
|---|---|---|
| `createNotification` | Client → Server | Send a notification to another user |
| `notification` | Server → Client | Receive a real-time notification |
| `joinRoom` | Client → Server | Join a chat room |
| `message` | Both | Send/receive chat messages |

---

## Media & File Handling

### Upload Flow

1. User selects file via `ReactDropzone`
2. NSFW check via `nsfwjs` — aborts if flagged
3. HEIC files converted to JPEG via `heic2any`
4. POST to `/api/media` as `FormData`
5. Server uploads to Sanity via `@sanity/client`
6. Returns Sanity asset URL stored in Post/User document

### Sanity Image URL (`lib/getSanityImage.ts`)

```typescript
import { getSanityImageUrl } from "@/lib/getSanityImage";

const url = getSanityImageUrl(sanityImageRef)
  .width(800)
  .format("webp")
  .url();
```

### Sanity Studio

Available at `/api/media/studio` — full Sanity content management UI embedded via the Next.js route.

---

## AI Integration

### Google Gemini (`lib/gemini.ts`)

```typescript
import { gemini } from "@/lib/gemini";

const response = await gemini.generateContent({
  model: "gemini-2.5-flash-lite-preview-06-17",
  contents: [{ role: "user", parts: [{ text: prompt }] }],
});
```

Used in:
- `/api/companion` — travel companion matching/suggestions
- `/api/suggestion` — AI content suggestions for posts
- `/companions` page — interactive AI companion chat

---

## Frontend — Pages & Components

### Page Inventory

| Route | Component | Auth Required | Description |
|---|---|---|---|
| `/` | `page.tsx` | No | Redirects to `/feed` if authed, else `/home` |
| `/home` | `home/page.tsx` | No | Marketing landing page |
| `/feed` | `feed/page.tsx` | Yes | Main social feed |
| `/post/[id]` | `post/[id]/page.tsx` | No | Post detail with comments |
| `/person/[id]` | `person/[id]/page.tsx` | Partial | User profile (pass `me` for own) |
| `/tribes` | `tribes/page.tsx` | Yes | Tribe discovery |
| `/tribes/[id]` | `tribes/[id]/page.tsx` | Yes | Tribe detail + posts + members |
| `/shop` | `shop/page.tsx` | No | Shop listings (Sanity) |
| `/shop/[id]` | `shop/[id]/page.tsx` | No | Shop detail |
| `/product/[id]` | `product/[id]/page.tsx` | No | Product detail |
| `/chat` | `chat/page.tsx` | Yes | Chat interface (WIP) |
| `/companions` | `companions/page.tsx` | Yes | AI companion feature |
| `/notifications` | `notifications/page.tsx` | Yes | Notification center |
| `/settings` | `settings/page.tsx` | Yes | Settings hub |
| `/settings/account-settings` | `settings/account-settings/page.tsx` | Yes | Account preferences |
| `/login` | `login/page.tsx` | No | Login form |
| `/signup` | `signup/page.tsx` | No | Registration form |
| `/forgot-password` | `forgot-password/page.tsx` | No | Password reset request |
| `/verify/[id]` | `verify/[id]/page.tsx` | No | Email verification |
| `/misc/analytics` | Analytics dashboard | No | Chart.js stats |
| `/misc/reviews` | Reviews page | No | Platform feedback |

### Key Reusable Components

**Layout:**
- `LayoutProviders` — composes ThemeProvider, QueryClientProvider, SessionProvider, and navigation
- `DesktopSidebar` — left navigation with all main routes
- `DesktopHeader` — top bar with search and user menu
- `MobileNavigation` — bottom tab bar for mobile

**Feed:**
- `TripotterFeed` — root feed component with auth guard
- `PostContainer` — renders list of posts (used in feed + profiles)
- `CreatePost` — post creation modal (dynamic import)
- `UserStories` — horizontal story carousel
- `SuggestedUsers` — right sidebar with follow suggestions

**Social:**
- `FollowButton` — follow/unfollow with optimistic mutation
- `FollowModal` — modal showing followers/following lists
- `ProfileEditModal` — inline profile editing
- `SearchModal` — global `cmd+k` search

**Tribes:**
- `TribesPage` — discovery with filter sidebar
- `TribePage` — tribe detail with posts/members/join
- `TribeMemberButton` — join/leave action

**Editor:**
- `RichTextEditor` (Tiptap) — full-featured editor for journals and long-form posts

---

## Type Definitions

Located in `/types/`:

```typescript
// user.d.ts
interface UserDocument {
  _id: string;
  serial: string;
  fullName: string;
  username: string;
  email: string;
  profileImage: string;
  coverImage: string;
  bio: string;
  location: string;
  socials: { platform: string; url: string }[];
  role: "USER" | "BUSINESS";
  reputation: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// post.d.ts
interface PostDocument {
  serial: string;
  image: string[];
  caption: string;
  location: string;
  owner: UserDocument;
  hashtags: string[];
  postType: "POST" | "JOURNAL";
  fromGroup?: string;
  comments: CommentDocument[];
  likes: UserDocument[];
  createdAt: Date;
  updatedAt: Date;
}

// tribes.d.ts
interface TribeDocument {
  serial: string;
  name: string;
  description: string;
  category: TribeCategory;
  tags: string[];
  coverImage: string;
  profileImage: string;
  users: string[];
  posts: string[];
  createdBy: string;
  privacy: "PUBLIC" | "PRIVATE";
  usersCount: number;
  postsCount: number;
}
```

---

## Environment Variables

Full reference for `.env.local`:

```env
# ── Database ──────────────────────────────────────────────────────────────────
MONGODB_URI="mongodb://localhost:27017/tripotter"

# ── Authentication ────────────────────────────────────────────────────────────
AUTH_SECRET="your-nextauth-secret-at-least-32-chars"
AUTH_GOOGLE_ID="your-google-oauth-client-id"
AUTH_GOOGLE_SECRET="your-google-oauth-client-secret"
JWT_SECRET="your-jwt-secret"

# ── External Services ─────────────────────────────────────────────────────────
GOOGLE_GENAI_API_KEY="your-gemini-api-key"
RESEND_API_KEY="re_your-resend-key"

# ── Sanity CMS ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SANITY_PROJECT_ID="your-sanity-project-id"
NEXT_PUBLIC_SANITY_DATASET="production"
NEXT_PUBLIC_SANITY_API_TOKEN="your-sanity-api-token"
NEXT_PUBLIC_SANITY_API_VERSION="2025-07-06"

# ── Service URLs ──────────────────────────────────────────────────────────────
# tripotter-pulse NestJS microservice
PULSE_BASE_URL="http://localhost:10000"
NEXT_PUBLIC_PULSE_BASE_URL="http://localhost:10000"

# This Next.js app
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"

# WebSocket endpoint
NEXT_PUBLIC_WS_BASE_URL="http://localhost:10000"
```

---

## Incomplete Features & Recommended Paths

### 1. Personalized Feed (v2)

**File:** `app/api/feed/feed.action.ts` — `getPublicFeed_v2()`

**Current state:** Function exists but crashes when `joinedTribes` or `createdTribes` arrays are empty.

**Recommended fix:**
```typescript
// Guard against empty arrays before using in $in query
const tribeIds = [...(joinedTribes ?? []), ...(createdTribes ?? [])];
const query = tribeIds.length > 0
  ? { $or: [{ owner: { $in: followingIds } }, { fromGroup: { $in: tribeIds } }] }
  : { owner: { $in: followingIds } };
```

### 2. Chat System

**File:** `app/chat/page.tsx`, `components/chat-page/chat-page.tsx`

**Current state:** Page shell and chat layout exist. Socket.io client is wired. No message send/receive UI.

**Recommended implementation:**
1. Add `MessageInput` component — text input + send button
2. Emit `message` event via `useWebsocket()` on submit
3. Listen for `message` events and append to local state
4. Store message history in MongoDB via pulse service API
5. Fetch message history on room join

### 3. Companions Feature

**File:** `app/companions/page.tsx`

**Current state:** Page exists, AI client (`lib/gemini.ts`) is available.

**Recommended implementation:**
1. Build a form to capture traveler preferences (destination, dates, interests)
2. POST to `/api/companion` which calls Gemini to suggest matching profiles
3. Display suggested users with a `FollowButton` or "Connect" CTA

### 4. Settings Tabs (Notifications / Privacy / Business)

**File:** `app/settings/page.tsx` — tabs have `opacity-50 pointer-events-none`

**Recommended:** Remove disabled styles and implement preference forms that PATCH to `/api/users` with a `preferences` field.

### 5. Password Reset URL

**File:** `app/api/auth/verification/route.ts`

**Current state:** Hardcoded `http://localhost:10000` fallback.

**Fix:**
```typescript
const pulseUrl = process.env.PULSE_BASE_URL ?? "http://localhost:10000";
const response = await fetch(`${pulseUrl}/api/verification/`, { ... });
```

### 6. Tribe Creator Population

**File:** `app/api/tribe/tribe.action.ts` — `getTribeBySerial()`

**Current state:** Aggregation pipeline doesn't properly `$lookup` the creator user.

**Fix:** Add a `$lookup` stage to join the `users` collection on `createdBy`.

---

## Deployment Guide

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set all environment variables from the `.env.local` reference above
4. Set `NEXT_PUBLIC_API_BASE_URL` to your production URL (e.g. `https://tripotter.vercel.app/api`)
5. Deploy `tripotter-pulse` separately (Railway, Render, or a VPS)
6. Update `PULSE_BASE_URL` and `NEXT_PUBLIC_WS_BASE_URL` to pulse's production URL

### Docker (Self-hosted)

Ensure MongoDB and Redis containers are running. Set `MONGODB_URI` to the container hostname.

```bash
# Build
pnpm build

# Start
pnpm start
```

### Environment-specific Notes

- `NEXT_PUBLIC_*` variables are baked into the client bundle at build time — set them before building.
- `AUTH_SECRET` must be the same across all instances if you scale horizontally.
- Sanity tokens are write-enabled — keep `NEXT_PUBLIC_SANITY_API_TOKEN` confidential (despite the `NEXT_PUBLIC_` prefix naming, treat it as a server secret in production by using a Sanity token with minimal permissions or moving it to a server-only variable).
