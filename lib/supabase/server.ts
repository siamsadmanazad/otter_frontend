/**
 * Supabase server client (Server Components, Route Handlers, Server Actions).
 *
 * Reads/writes the auth session via cookies (@supabase/ssr), so the user's session is shared between
 * the browser and the server. Uses the anon key — RLS applies. For privileged, RLS-bypassing writes
 * inside API routes, use ./admin instead.
 *
 * NOTE: must be called within a request scope (it awaits next/headers cookies()).
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local (see .env.example)."
  );
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll called from a Server Component (read-only cookies). Safe to ignore when a
          // middleware/route is responsible for refreshing the session.
        }
      },
    },
  });
}
