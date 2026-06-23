import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/blocks -> the accounts I've blocked (populated, newest-first).
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const db = createAdminClient();
    const { data, error } = await db
      .from("blocks")
      .select(
        "created_at, p:profiles!blocks_blocked_id_fkey(id, username, full_name, profile_image)"
      )
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);

    const users = ((data ?? []) as any[]).map((row: any) => ({
      id: row.p?.id,
      username: row.p?.username,
      fullName: row.p?.full_name,
      profileImage: row.p?.profile_image,
    }));
    return ok(users, "Blocked accounts");
  } catch (e) {
    console.error("GET /api/blocks error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/blocks  body { targetUserId } -> block (and sever follow edges both ways).
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { targetUserId } = await request.json();
    if (!targetUserId?.trim() || !UUID_RE.test(targetUserId))
      return fail("A valid targetUserId is required", 400);
    if (targetUserId === user.id) return fail("You can't block yourself", 400);

    const db = createAdminClient();
    const { error } = await db
      .from("blocks")
      .upsert(
        { blocker_id: user.id, blocked_id: targetUserId },
        { onConflict: "blocker_id,blocked_id" }
      );
    if (error) return fail(error.message, 500);

    // Remove any follow relationship in either direction.
    await db
      .from("follows")
      .delete()
      .or(
        `and(follower_id.eq.${user.id},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${user.id})`
      );

    return ok({ blocked: true }, "User blocked");
  } catch (e) {
    console.error("POST /api/blocks error:", e);
    return fail("Internal server error", 500);
  }
}

// DELETE /api/blocks?targetUserId=<uuid> -> unblock.
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const targetUserId = request.nextUrl.searchParams.get("targetUserId");
    if (!targetUserId?.trim()) return fail("targetUserId is required", 400);

    const db = createAdminClient();
    const { error } = await db
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId);
    if (error) return fail(error.message, 500);

    return ok({ blocked: false }, "User unblocked");
  } catch (e) {
    console.error("DELETE /api/blocks error:", e);
    return fail("Internal server error", 500);
  }
}
