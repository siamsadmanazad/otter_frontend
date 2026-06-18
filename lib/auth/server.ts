/**
 * Server-side auth helpers for Route Handlers / Server Components.
 * Replaces getServerSession(authOptions). Used by the rebuilt app/api routes (data seam).
 *
 * getServerUser(): resolves the caller from the Supabase cookie session OR an
 * `Authorization: Bearer <access_token>` header (so the future Flutter client uses the same routes).
 * Returns the caller's profile id + email, or null.
 */
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface ServerUser {
  id: string;
  email: string | null;
}

export async function getServerUser(req?: Request): Promise<ServerUser | null> {
  // 1) Bearer token (mobile / non-cookie clients)
  const authz = req?.headers.get("authorization") ?? req?.headers.get("Authorization");
  if (authz?.startsWith("Bearer ")) {
    const token = authz.slice(7);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createSupabaseClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }

  // 2) Cookie session (web)
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
