# TripOtter — Reusable Feed UI/UX System (Flutter)

> On approval, **Step 0** copies this document to `otter_frontend/UI.md` (repo-visible),
> then implementation proceeds. All work in `otter_flutter`, `flutter analyze`-clean,
> commit + push per step.

## Context

The app already has a premium, Apple-like **profile direction** (cinematic collapsing
`ProfileHeroSliver` capsule on a light `#F7F8FA` scaffold). But the post surfaces are
inconsistent and under-built:

- **Profile** uses a hardcoded **3-col 1:1 square** grid (`post_grid.dart`) — rigid, not Pinterest-like.
- **Home feed** uses a nice **Editorial Noir** `PostCard` (hardcoded 4:5), but it's a *separate*
  system from the profile grid → profile and home feel like different products.
- **No multi-photo support** in the UI (`Post.images` is already `List<String>`, backend stores an
  array, but only the first image is ever shown; `FullscreenImageViewer` is single-image).
- **No controlled aspect-ratio system** → any masonry would be chaotic.

Goal: one **reusable, controlled-masonry feed system** (light & airy, Apple/Pinterest) shared by
Profile "Moments", person profiles, and (fast-follow) Explore — with multi-photo posts and a polished
full-screen gallery viewer. The home "Following" feed keeps its expanded cards but gains multi-photo.

### Locked decisions (confirmed with user)
- **Scope this pass:** Foundation (tokens + ratio mapper) → reusable masonry grid + card → multi-photo
  full-screen viewer → Profile/Person **Moments/Media tabs**. *Fast-follow (next pass): composer
  multi-select, Explore masonry tab.*
- **Grid look:** **Light & airy** (image tiles on off-white, glass badges) — not dark Noir tiles.
- **Home feed:** keep the expanded `PostCard` list ("Following"); add Explore masonry later. Profile
  Moments uses the new masonry now.

### Hard constraints found in code
1. `/api/media` returns only `{url}` — **no width/height, no thumbnail variants**
   (`otter_frontend/app/api/media/route.ts`). So display ratios are **measured client-side at first load
   and cached per URL**, then snapped to an approved ratio. (Backend integration point below.)
2. Backend `images` is a real **array** end-to-end (`build_post_json` → `'image', to_jsonb(p.images)`;
   `posts` route accepts `body.image[]`) → multi-photo is storable today; only the UI was missing.
3. No `saved`/`tagged` backend → those tabs render polished "coming soon" empty states. **Moments**
   (all posts) and **Media** (image posts) are live.

## Approved display-ratio system

Approved ratios (width/height): `1:1`(1.0) · `4:5`(0.8) · `3:4`(0.75) · `4:3`(1.333) · `16:9`(1.778) · `2:3`(0.667).

`mapToDisplayRatio(double aspect)`: clamp `aspect` to `[0.62, 1.85]` (kills extreme tall/wide), then
return the approved ratio with the smallest absolute difference. Result cached per image URL for the
session → stable layout, no scroll-jump after the first measure.

## New files (`otter_flutter/lib/`)

- **`core/feed_design.dart`** — feed tokens: spacing scale + `FeedSpacing` (pagePad 16, gridGap 10,
  cardRadius 22, mediaRadius 20, tabsGap 14), `FeedDisplayRatio` enum (the 6 ratios), and
  `mapToDisplayRatio()`. Reuses `AppTheme` brand + `ProfileMotion` (durations/curves) from
  `screens/profile/widgets/profile_hero.dart`.
- **`core/image_ratio_cache.dart`** — `ImageRatioCache`: resolves a `CachedNetworkImageProvider`'s
  intrinsic size via an `ImageStreamListener`, maps → `FeedDisplayRatio`, caches `Map<String,double>`.
  Exposes `cachedRatio(url)` (nullable) + `resolve(url)` (Future) so a tile can place at a default
  then settle to the measured ratio.
- **`screens/feed/widgets/feed_media.dart`** — `FeedMedia`: reusable preview. `CachedNetworkImage`
  at the mapped ratio, `BoxFit.cover`, `mediaRadius`, neutral placeholder, **fade-in + scale 0.98→1**,
  error state. Optional multi-photo + journal badges.
- **`screens/feed/widgets/multi_photo_badge.dart`** — subtle **glass** stacked-photo badge (count),
  used on grid tiles and the carousel. Apple-quiet, not loud.
- **`screens/feed/widgets/feed_grid_card.dart`** — `FeedGridCard` (compact): image → `FeedMedia` at
  mapped ratio + badges; text/journal → quiet light caption tile. Press-scale → `onOpen`.
- **`screens/feed/widgets/masonry_feed_grid.dart`** — `MasonryFeedGridSliver` (2-col; 3-col when
  width ≥ 600) via `SliverMasonryGrid`; subtle staggered entrance; plus `FeedGridSkeletonSliver`
  (rounded shimmer tiles in varied ratios, reusing `widgets/skeleton.dart`).
- **`screens/feed/widgets/feed_tabs.dart`** — `FeedTabs`: text tabs with an **animated rounded
  underline** (Moments/Media/Saved/Tagged). Active = stronger weight + brand underline; inactive =
  soft gray. No heavy Material `TabBar`.

## Modified files

- **`pubspec.yaml`** — add `flutter_staggered_grid_view: ^0.7.0`.
- **`screens/feed/fullscreen_image.dart`** — add `FullscreenImageViewer.openGallery(images,
  initialIndex, heroTagFor)`: `PageView` swipe + page dots + per-page pinch-zoom + **drag-down to
  dismiss** + dark bg + **auto-hiding controls** (tap toggles) + close. Keep `open()` (single) as a
  thin wrapper for back-compat.
- **`screens/tabs/profile_screen.dart`** & **`screens/person/person_screen.dart`** — after the hero:
  insert `FeedTabs` (Moments default) + swap `PostGridSliver` → `MasonryFeedGridSliver`. Moments = all
  posts; Media = image posts; Saved/Tagged = polished empty. Tap tile → existing
  `PostFeedScreen.openPostAt` (journals → reader). Keep nav bottom padding.
- **`screens/feed/widgets/post_card.dart`** (expanded/home) — when `images.length > 1`: media becomes
  a **carousel** (PageView + dots) + multi-photo badge; tap any image → `openGallery` at that index.
  Single-image + text/journal layouts unchanged → home look preserved, multi-photo added.
- **`screens/feed/post_feed_screen.dart`** — `_openContent` multi-photo → `openGallery(all images)`.
- **Delete `screens/profile/widgets/post_grid.dart`** — replaced by the reusable grid (no duplicate
  profile grid, per spec). Repoint both importers.

## Reuse (don't rebuild)
`Noir`/`ProfileMotion`/`ProfileStat` (`profile_hero.dart`), `AppTheme.brandGradient` (`core/theme.dart`),
`EmptyState` (`widgets/empty_state.dart`), shimmer in `widgets/skeleton.dart`, `compactCount`/`timeAgo`
(`core/format.dart`), `PostFeedScreen.openPostAt` + `JournalScreen` routing, `CachedNetworkImage`.

## Backend integration points (note, not blocking)
- Add `width`/`height` (and ideally a `thumbnailUrl` + `blurHash`/dominant color) to `/api/media` +
  `media`/`build_post_json` so ratio is server-known and placeholders are instant (removes the one-time
  client measure + reflow). Until then: client-measured + cached.
- Multi-photo create = composer multi-select (fast-follow) — array path already works.
- `Saved`/`Tagged` need a saves table + tag join — deferred.

## Verification
- `flutter analyze` clean after each step.
- App already running on the Pixel emulator (`a@a.co` / `123456`) → hot-reload and walk:
  Profile → Moments masonry shows **varied controlled ratios**, no scroll-jump after settle; tap tile →
  immersive feed / journal reader; Media tab filters to image posts; Saved tab = clean empty; tab
  underline animates; loading skeleton + empty + error states look designed; bottom nav never covers the
  last row. Full-screen viewer: swipe between images, pinch-zoom, drag-down dismiss, controls auto-hide.
  Person profile mirrors Profile exactly.
- Seed posts are single-image, so the carousel/gallery multi-image path is fully exercised once a
  multi-photo post exists (composer fast-follow); the viewer still works for single images today.

## Out of scope this pass (fast-follow)
Composer multi-image select + reorder; Explore/Discover masonry tab in Search + optional Home tab;
server-side thumbnails/dimensions/blurhash; Saved/Tagged backends.
