/**
 * OAuth + password-recovery callback. Supabase redirects here with a `code`; we exchange it for a
 * cookie session (via @supabase/ssr), then forward to `next` (default /feed).
 * Used by Google sign-in and the password-reset email link.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/feed";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  // No code or exchange failed -> back to login.
  return NextResponse.redirect(new URL("/login", url.origin));
}
