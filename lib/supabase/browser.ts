/**
 * Supabase browser client (client components / hooks).
 *
 * Uses the anon (public) key — all access is RLS-bound. Safe to ship to the browser.
 * For server code use ./server (cookie session) or ./admin (service-role, API routes only).
 */
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local (see .env.example)."
  );
}

export function createClient() {
  return createBrowserClient(url!, anonKey!);
}
