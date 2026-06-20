import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/reaction  body { post } -> toggle like -> { isLiked, likeCount, likeId }
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json();
    const postId: string | undefined = body.post ?? body.postId;
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_like", { p_post_id: postId });
    if (error) {
      if (error.message.includes("POST_NOT_FOUND")) return fail("Post not found", 404);
      return fail(error.message, 500);
    }
    const isLiked = (data as { isLiked: boolean }).isLiked;
    return ok(data, isLiked ? "Post liked successfully" : "Post unliked successfully");
  } catch (e) {
    console.error("POST /api/reaction error:", e);
    return fail("Internal server error", 500);
  }
}

// GET /api/reaction?id=<postId>  (also ?postId=) -> users who liked
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const sp = request.nextUrl.searchParams;
    const postId = sp.get("id") ?? sp.get("postId");
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const db = createAdminClient();
    const { data, error } = await db
      .from("likes")
      .select("user:profiles!likes_user_id_fkey(id, username, full_name, profile_image)")
      .eq("post_id", postId);
    if (error) return fail(error.message, 500);

    const users = ((data ?? []) as any[]).map((row: any) => ({
      id: row.user?.id,
      username: row.user?.username,
      fullName: row.user?.full_name,
      profileImage: row.user?.profile_image,
    }));
    return ok(users, "Retrieved likes");
  } catch (e) {
    console.error("GET /api/reaction error:", e);
    return fail("Internal server error", 500);
  }
}
