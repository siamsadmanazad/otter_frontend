/**
 * Supabase service-role (admin) client — SERVER ONLY, API routes / trusted server code.
 *
 * The service-role key BYPASSES Row-Level Security. Never import this into a client component and
 * never expose the key (it is not NEXT_PUBLIC_). Every route that uses this MUST enforce auth itself
 * (verify the caller's session/JWT) — RLS will not protect you here.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local (see .env.example). SUPABASE_SERVICE_ROLE_KEY is server-only."
  );
}

/** Create a fresh service-role client. Use only inside server code (app/api/*). */
export function createAdminClient() {
  return createSupabaseClient(url!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
