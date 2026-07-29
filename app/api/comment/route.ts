import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

function mapComment(c: Record<string, any> | null) {
  if (!c) return null;
  return {
    id: c.id,
    content: c.content,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    post: c.post_id,
    parentId: c.parent_id ?? null,
    likeCount: c.like_count ?? 0,
    replyCount: c.reply_count ?? 0,
    iLiked: false, // a comment you just created/edited can't already be liked by you
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

// POST /api/comment  body { content, post, parentId? } -> add comment (or
// reply) + notify post owner (COMMENT) and, for a reply, the parent
// comment's owner too (COMMENT_REPLY) if that's someone other than the
// actor. One-level nesting (feed_detail_split.md F6) is enforced by the
// comments_normalize_parent trigger, not here — a reply-to-a-reply lands
// re-parented to the top-level ancestor and this route never needs to know.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // Anti-spam: max 10 comments / 60s per user.
    const limited = await enforceRateLimit("comment", user.id, request, 10, 60);
    if (limited) return limited;

    const body = await request.json();
    const content: string = body.content;
    const postId: string = body.post ?? body.postId;
    const parentId: string | null =
      typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;
    if (!content?.trim()) return fail("Comment content is required", 400);
    if (!postId?.trim()) return fail("Post ID is required", 400);

    const db = createAdminClient();
    const { data: comment, error } = await db
      .from("comments")
      .insert({ owner_id: user.id, post_id: postId, content, parent_id: parentId })
      .select(
        "id, content, created_at, updated_at, post_id, parent_id, like_count, reply_count, owner:profiles!comments_owner_id_fkey(id, username, full_name, profile_image)"
      )
      .single();
    if (error) {
      if (error.message.includes("PARENT_NOT_FOUND")) return fail("Parent comment not found", 404);
      if (error.message.includes("PARENT_POST_MISMATCH")) {
        return fail("Parent comment belongs to a different post", 400);
      }
      return fail(error.message, 500);
    }

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
    // comment.parent_id is the NORMALIZED id (trigger may have re-parented
    // it up to the top-level ancestor), so this always notifies the right
    // person even for a reply-to-a-reply.
    if (comment.parent_id) {
      const { data: parent } = await db
        .from("comments")
        .select("owner_id")
        .eq("id", comment.parent_id)
        .single();
      if (parent?.owner_id && parent.owner_id !== user.id) {
        await db.rpc("create_notification", {
          p_recipient_id: parent.owner_id,
          p_actor_id: user.id,
          p_type: "COMMENT_REPLY",
          p_target_type: "COMMENT",
          p_target_id: comment.parent_id,
          p_message: null,
        });
      }
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
