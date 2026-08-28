/**
 * Admin gate for Phase 11's moderation dashboard (gamify.md §64).
 *
 * There is no admin-management UI (see the migration's own note) -- role is
 * flipped by hand via service role. This helper is the ONE place that checks
 * it, so every /api/admin/* route and the /admin page itself stay consistent.
 */
import { getServerUser, ServerUser } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminUser extends ServerUser {
  role: "ADMIN";
}

/** Resolves the caller only if authenticated AND profiles.role = 'ADMIN'. */
export async function getAdminUser(request?: Request): Promise<AdminUser | null> {
  const user = await getServerUser(request);
  if (!user) return null;

  const db = createAdminClient();
  const { data, error } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.profileId)
    .single();
  if (error || data?.role !== "ADMIN") return null;

  return { ...user, role: "ADMIN" };
}
