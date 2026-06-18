/**
 * Shared API helpers for the rebuilt Supabase routes.
 * Preserves the legacy envelope { message, status, data } the client (lib/requests.ts) reads.
 */
import { NextResponse } from "next/server";

export function ok(data: unknown, message = "OK", status = 200) {
  return NextResponse.json({ message, status, data }, { status });
}

export function fail(message: string, status = 500, data: unknown = null) {
  return NextResponse.json({ message, status, data }, { status });
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
