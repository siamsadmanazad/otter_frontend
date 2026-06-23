import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ids the user has blocked OR been blocked by (blocks hide content both ways).
 * Error-safe: returns [] if the `blocks` table isn't present yet (migration not
 * pushed to the target DB) so enforcement is a no-op until then — never a 500.
 */
export async function getBlockedPairIds(
  db: SupabaseClient,
  userId: string
): Promise<string[]> {
  try {
    const { data, error } = await db
      .from("blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
    if (error || !data) return [];
    const ids = new Set<string>();
    for (const r of data as { blocker_id: string; blocked_id: string }[]) {
      ids.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
    }
    return [...ids];
  } catch {
    return [];
  }
}

/** True if a and b have a block in either direction. Error-safe (false). */
export async function isBlockedPair(
  db: SupabaseClient,
  a: string,
  b: string
): Promise<boolean> {
  try {
    const { data } = await db
      .from("blocks")
      .select("blocker_id")
      .or(
        `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`
      )
      .limit(1);
    return !!(data && data.length);
  } catch {
    return false;
  }
}
