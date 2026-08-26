import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const ROLES = new Set(["MEMBER", "MODERATOR", "ADMIN"]); // FOUNDER is never assignable

// GET /api/business/staff — staff of the business the caller is currently
// ACTING AS (business_mode.md Phase 2.3's staff section). Targets
// user.profileId directly, same convention as /api/business/profile: no
// businessId in the request, so there's no ambiguity about which business.
// RLS (business_members_visible, 20260826300000) is the actual gate — this
// only degrades gracefully to an empty list if the caller isn't authorized
// or isn't acting as a business at all.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data: members, error } = await db
    .from("business_members")
    .select("user_id, role, joined_at")
    .eq("business_id", user.profileId)
    .order("joined_at", { ascending: true });
  if (error) return fail(error.message, 400);
  if (!members?.length) return ok([], "Staff retrieved");

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, full_name, profile_image")
    .in(
      "id",
      members.map((m) => m.user_id)
    );
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const data = members.map((m) => {
    const p = byId.get(m.user_id);
    return {
      userId: m.user_id,
      role: m.role,
      joinedAt: m.joined_at,
      username: p?.username ?? null,
      fullName: p?.full_name ?? null,
      profileImage: p?.profile_image ?? null,
    };
  });
  return ok(data, "Staff retrieved");
}

// POST /api/business/staff  body { username, role? } -> invites the named
// EXPLORER as staff of the caller's current business. role defaults to
// MEMBER; FOUNDER can never be assigned this way (RLS also enforces it).
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!username) return fail("username is required", 400);
  const role = typeof body?.role === "string" ? body.role : "MEMBER";
  if (!ROLES.has(role)) return fail("Invalid role", 400);

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, kind, username, full_name, profile_image")
    .eq("username", username)
    .maybeSingle();
  if (!target) return fail("No user with that username", 404);
  if (target.kind !== "EXPLORER") return fail("Only a personal profile can be invited as staff", 400);

  const db = await createActorClient(request);

  // Business Mode 7.2's staff-seat gate: check first so a blocked invite gets
  // a clean 402 instead of a generic RLS-violation message from the insert
  // below (business_members_insert_admin's WITH CHECK enforces the same
  // business_can_add_staff_seat rule server-side either way — this is only
  // about the error a caller sees, not a second source of truth). A no-op
  // today since subscription_gate_settings.enabled ships false.
  const { data: canAddSeat, error: seatCheckError } = await db.rpc("business_can_add_staff_seat", {
    p_business: user.profileId,
  });
  if (seatCheckError) return fail(seatCheckError.message, 400);
  if (!canAddSeat) return fail("SUBSCRIPTION_REQUIRED", 402);

  const { error } = await db
    .from("business_members")
    .insert({ business_id: user.profileId, user_id: target.id, role });
  if (error) {
    const status = error.code === "23505" ? 409 : 400; // already a member
    return fail(error.message, status);
  }

  return ok(
    {
      userId: target.id,
      role,
      username: target.username,
      fullName: target.full_name,
      profileImage: target.profile_image,
    },
    "Staff invited"
  );
}

// DELETE /api/business/staff?userId=<uuid> — removes a staff member from the
// caller's current business, or lets a staff member remove themselves
// (leave) regardless of role. RLS (business_members_delete_admin) is the
// actual authority check; FOUNDER can't be removed by anyone but themselves.
export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId?.trim()) return fail("userId is required", 400);

  const db = await createActorClient(request);
  const { error } = await db
    .from("business_members")
    .delete()
    .eq("business_id", user.profileId)
    .eq("user_id", userId);
  if (error) return fail(error.message, 400);

  return ok(null, "Staff removed");
}
