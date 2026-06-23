import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { isBlockedPair } from "@/lib/api/blocks";
import { ok, fail } from "@/lib/api/http";

// POST /api/followers  body { targetUserId } -> toggle follow -> { isFollowing, followersCount }
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { targetUserId } = await request.json();
    if (!targetUserId?.trim()) return fail("targetUserId is required", 400);

    // Can't follow across a block (either direction).
    if (await isBlockedPair(createAdminClient(), user.id, targetUserId))
      return fail("You can't follow this account", 403);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_follow", { p_target_id: targetUserId });
    if (error) {
      if (error.message.includes("CANNOT_FOLLOW_SELF")) return fail("Cannot follow yourself", 400);
      if (error.message.includes("USER_NOT_FOUND")) return fail("User not found", 404);
      return fail(error.message, 500);
    }
    const isFollowing = (data as { isFollowing: boolean }).isFollowing;
    return ok(data, isFollowing ? "Followed" : "Unfollowed");
  } catch (e) {
    console.error("POST /api/followers error:", e);
    return fail("Internal server error", 500);
  }
}

// GET /api/followers?profileId=<uuid>&type=followers|following -> user list
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const profileId = sp.get("profileId");
    const type = sp.get("type") === "following" ? "following" : "followers";
    if (!profileId?.trim()) return fail("profileId is required", 400);

    const db = createAdminClient();
    // followers -> people who follow profileId; following -> people profileId follows
    const query =
      type === "followers"
        ? db
            .from("follows")
            .select("p:profiles!follows_follower_id_fkey(id, username, full_name, profile_image)")
            .eq("following_id", profileId)
        : db
            .from("follows")
            .select("p:profiles!follows_following_id_fkey(id, username, full_name, profile_image)")
            .eq("follower_id", profileId);

    const { data, error } = await query;
    if (error) return fail(error.message, 500);

    const users = ((data ?? []) as any[]).map((row: any) => ({
      id: row.p?.id,
      username: row.p?.username,
      fullName: row.p?.full_name,
      profileImage: row.p?.profile_image,
    }));
    return ok(users, `Retrieved ${type}`);
  } catch (e) {
    console.error("GET /api/followers error:", e);
    return fail("Internal server error", 500);
  }
}
