import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/posts/[postId]/comments -> comments for a post (newest first)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
): Promise<Response> {
  try {
    const { postId } = await params;
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const db = createAdminClient();
    const { data, error } = await db
      .from("comments")
      .select(
        "id, content, created_at, updated_at, post_id, owner:profiles!comments_owner_id_fkey(id, username, full_name, profile_image)"
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);

    const comments = (data ?? []).map((c: Record<string, any>) => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      owner: c.owner
        ? {
            id: c.owner.id,
            username: c.owner.username,
            fullName: c.owner.full_name,
            profileImage: c.owner.profile_image,
          }
        : undefined,
    }));
    return ok(comments, "Comments retrieved");
  } catch (e) {
    console.error("GET /api/posts/[postId]/comments error:", e);
    return fail("Internal server error", 500);
  }
}
