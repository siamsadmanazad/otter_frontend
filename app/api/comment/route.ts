import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

function mapComment(c: Record<string, any> | null) {
  if (!c) return null;
  return {
    id: c.id,
    content: c.content,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    post: c.post_id,
    owner: c.owner
      ? {
          id: c.owner.id,
          username: c.owner.username,
          fullName: c.owner.full_name,
          profileImage: c.owner.profile_image,
        }
      : undefined,
  };
}

async function refreshCommentCount(db: ReturnType<typeof createAdminClient>, postId: string) {
  const { count } = await db
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId);
  await db.from("posts").update({ comment_count: count ?? 0 }).eq("id", postId);
}

// POST /api/comment  body { content, post } -> add comment (+ notify post owner)
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const body = await request.json();
    const content: string = body.content;
    const postId: string = body.post ?? body.postId;
    if (!content?.trim()) return fail("Comment content is required", 400);
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const db = createAdminClient();
    const { data: comment, error } = await db
      .from("comments")
      .insert({ owner_id: user.id, post_id: postId, content })
      .select(
        "id, content, created_at, updated_at, post_id, owner:profiles!comments_owner_id_fkey(id, username, full_name, profile_image)"
      )
      .single();
    if (error) return fail(error.message, 500);

    const { data: post } = await db.from("posts").select("owner_id").eq("id", postId).single();
    if (post?.owner_id) {
      await db.rpc("create_notification", {
        p_recipient_id: post.owner_id,
        p_actor_id: user.id,
        p_type: "COMMENT",
        p_target_type: "POST",
        p_target_id: postId,
        p_message: null,
      });
    }
    await refreshCommentCount(db, postId);
    return ok(mapComment(comment), "Comment added");
  } catch (e) {
    console.error("POST /api/comment error:", e);
    return fail("Internal server error", 500);
  }
}

// PATCH /api/comment  body { id, content } -> edit own comment
export async function PATCH(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);
    const { id, content } = await request.json();
    if (!id || !content?.trim()) return fail("id and content are required", 400);

    const db = createAdminClient();
    const { data, error } = await db
      .from("comments")
      .update({ content })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select(
        "id, content, created_at, updated_at, post_id, owner:profiles!comments_owner_id_fkey(id, username, full_name, profile_image)"
      )
      .single();
    if (error || !data) return fail("Comment not found", 404);
    return ok(mapComment(data), "Comment updated");
  } catch (e) {
    console.error("PATCH /api/comment error:", e);
    return fail("Internal server error", 500);
  }
}

// DELETE /api/comment?id=<uuid> -> delete own comment
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return fail("Comment ID is required", 400);

    const db = createAdminClient();
    const { data, error } = await db
      .from("comments")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id, post_id")
      .single();
    if (error || !data) return fail("Comment not found", 404);
    await refreshCommentCount(db, data.post_id);
    return ok({ id }, "Comment deleted");
  } catch (e) {
    console.error("DELETE /api/comment error:", e);
    return fail("Internal server error", 500);
  }
}
