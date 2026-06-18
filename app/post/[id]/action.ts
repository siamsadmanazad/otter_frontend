import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server-side single-post fetch (used by app/post/[id]). Uses the build_post_json RPC (IPostProps).
export default async function GetPost(id: string) {
  try {
    if (!UUID_RE.test(id)) return null;
    const db = createAdminClient();
    const { data, error } = await db.rpc("build_post_json", { p_post_id: id });
    if (error || !data) return null;

    const post = data as Record<string, any>;
    return {
      ...post,
      stats: {
        likesCount: post.likes?.length || 0,
        commentsCount: post.comments?.length || 0,
        hasImage: Array.isArray(post.image) && post.image.length > 0,
        hasCaption: typeof post.caption === "string" && post.caption.trim().length > 0,
      },
      comments: post.comments || [],
      likedBy: post.likes || [],
    };
  } catch (error) {
    console.error("Error fetching post:", error);
    return null;
  }
}
