/**
 * Shared API helpers for the rebuilt Supabase routes.
 * Preserves the legacy envelope { message, status, data } the client (lib/requests.ts) reads.
 */
import { NextResponse } from "next/server";
import { captureRouteError } from "@/lib/observability";

export function ok(
  data: unknown,
  message = "OK",
  status = 200,
  // Phase 3 (graceful degradation, D14): when a route's primary data loaded
  // fine but a secondary enrichment step failed, set `partial: true` so the
  // client can render the primary data with a "some info unavailable"
  // affordance instead of either erroring wholesale or silently showing
  // possibly-wrong fallback values (e.g. a count coalesced to 0).
  partial = false
) {
  return NextResponse.json(
    { message, status, data, ...(partial ? { partial: true } : {}) },
    { status }
  );
}

export function fail(message: string, status = 500, data: unknown = null) {
  // Auto-report server errors (5xx) to observability; 4xx are client/validation
  // errors and intentionally NOT reported (would be noise). No-op without SENTRY_DSN.
  if (status >= 500) captureRouteError(message, { status });
  return NextResponse.json({ message, status, data }, { status });
}

/** Map a tribes row (snake_case) to the camelCase tribe shape the UI expects (ITribe). */
export function mapTribe(t: Record<string, any> | null) {
  if (!t) return null;
  return {
    id: t.id,
    serial: t.serial,
    name: t.name,
    description: t.description,
    category: t.category,
    tags: t.tags ?? [],
    coverImage: t.cover_image,
    profileImage: t.profile_image,
    privacy: t.privacy,
    // Travel-tribe identity + anchor (present once the essentials migration runs).
    rules: t.rules ?? null,
    destination: t.destination ?? null,
    tripStart: t.trip_start ?? null,
    tripEnd: t.trip_end ?? null,
    membersCount: t.member_count ?? undefined,
    postsCount: t.post_count ?? undefined,
    createdBy: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

/** Map a profiles row (snake_case) to a compact public user shape. */
export function mapPublicUser(u: Record<string, any> | null) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    profileImage: u.profile_image,
  };
}

/** Map a profiles row (snake_case) to the camelCase user shape the UI expects. */
export function mapProfile(p: Record<string, unknown> | null) {
  if (!p) return null;
  return {
    id: p.id,
    serial: p.serial,
    fullName: p.full_name,
    username: p.username,
    email: p.email,
    bio: p.bio,
    location: p.location,
    socials: p.socials ?? [],
    coverImage: p.cover_image,
    profileImage: p.profile_image,
    role: p.role,
    reputation: p.reputation,
    active: p.active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}
