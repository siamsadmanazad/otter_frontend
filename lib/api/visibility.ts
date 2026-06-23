import type { SupabaseClient } from "@supabase/supabase-js";
import { withDefaults } from "@/lib/preferences";

/**
 * Whether `viewerId` may see `targetId`'s profile + posts, given the target's
 * `privacy.profileVisibility`:
 *  - PUBLIC    → everyone (incl. anonymous)
 *  - FOLLOWERS → the target's followers (and the target)
 *  - PRIVATE   → the target only
 * Self always passes.
 */
export async function canViewProfile(
  db: SupabaseClient,
  viewerId: string | null,
  targetId: string,
  targetPreferences: unknown
): Promise<boolean> {
  if (viewerId && viewerId === targetId) return true;
  const visibility = withDefaults(targetPreferences).privacy.profileVisibility;
  if (visibility === "PUBLIC") return true;
  if (!viewerId) return false; // FOLLOWERS / PRIVATE need an authenticated follower
  if (visibility === "PRIVATE") return false;
  // FOLLOWERS: the viewer must follow the target.
  const { count } = await db
    .from("follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("follower_id", viewerId)
    .eq("following_id", targetId);
  return (count ?? 0) > 0;
}
