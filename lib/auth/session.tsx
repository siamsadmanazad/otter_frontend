"use client";

/**
 * NextAuth-compatible auth layer, backed by Supabase.
 *
 * Drop-in replacement for `next-auth/react` so components don't change:
 *   - useSession()  -> { data: Session | null, status: "loading"|"authenticated"|"unauthenticated", update }
 *   - signIn(provider, options)  -> { ok, error, status, url }  (credentials | google)
 *   - signOut(options)
 *   - signUp(...)   (extra helper; not in NextAuth)
 *
 * session.user keeps the exact legacy shape: { id, serial, username, name, email, image }
 * where id = profiles.id (= auth.users.id), name = profiles.full_name, image = profiles.profile_image.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";

export interface SessionUser {
  id: string;
  serial: string;
  username: string;
  name: string;
  email: string;
  image: string | null;
}
export interface Session {
  user: SessionUser;
}
export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionContextValue {
  data: Session | null;
  status: SessionStatus;
  update: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  data: null,
  status: "loading",
  update: async () => {},
});

async function mapUserToSession(
  supabase: ReturnType<typeof createClient>,
  user: User | null
): Promise<Session | null> {
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, serial, username, full_name, profile_image, email, active")
    .eq("id", user.id)
    .single();

  // No profile yet (trigger lag) or deactivated => treat as signed-out.
  if (!profile || profile.active === false) return null;

  return {
    user: {
      id: profile.id,
      serial: profile.serial,
      username: profile.username,
      name: profile.full_name,
      email: profile.email ?? user.email ?? "",
      image: profile.profile_image ?? null,
    },
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const mapped = await mapUserToSession(supabase, session?.user ?? null);
    setData(mapped);
    setStatus(mapped ? "authenticated" : "unauthenticated");
  }, [supabase]);

  useEffect(() => {
    let active = true;
    refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const mapped = await mapUserToSession(supabase, session?.user ?? null);
      if (!active) return;
      setData(mapped);
      setStatus(mapped ? "authenticated" : "unauthenticated");
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, refresh]);

  const value = useMemo(
    () => ({ data, status, update: refresh }),
    [data, status, refresh]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/* ----------------------------- signIn / signUp / signOut ----------------------------- */

type SignInResult = { ok: boolean; error: string | null; status: number; url: string | null };

interface SignInOptions {
  email?: string;
  password?: string;
  redirect?: boolean;
  callbackUrl?: string;
}

export async function signIn(
  provider: "credentials" | "google",
  options: SignInOptions = {}
): Promise<SignInResult> {
  const supabase = createClient();
  const { email, password, redirect = true, callbackUrl } = options;

  if (provider === "credentials") {
    const { error } = await supabase.auth.signInWithPassword({
      email: email ?? "",
      password: password ?? "",
    });
    if (error) return { ok: false, error: error.message, status: 401, url: null };
    if (redirect && callbackUrl) window.location.href = callbackUrl;
    return { ok: true, error: null, status: 200, url: callbackUrl ?? null };
  }

  // Google OAuth: round-trips through /auth/callback to set the cookie session.
  const next = callbackUrl ?? "/feed";
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) return { ok: false, error: error.message, status: 500, url: null };
  return { ok: true, error: null, status: 200, url: redirectTo };
}

export interface SignUpData {
  fullName: string;
  username: string;
  email: string;
  password: string;
  agreeToTerms?: boolean;
}

/** Sign up with email/password; profile is auto-created by the DB trigger from this metadata. */
export async function signUp(
  data: SignUpData
): Promise<{ ok: boolean; error: string | null; needsConfirmation: boolean }> {
  const supabase = createClient();
  const { data: result, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName,
        username: data.username,
        agree_to_terms: data.agreeToTerms ?? true,
      },
    },
  });
  if (error) return { ok: false, error: error.message, needsConfirmation: false };
  // If email confirmation is on, there is no active session yet.
  return { ok: true, error: null, needsConfirmation: !result.session };
}

export async function signOut(
  options: { callbackUrl?: string; redirect?: boolean } = {}
) {
  const supabase = createClient();
  await supabase.auth.signOut();
  if (options.redirect === false) return;
  window.location.href = options.callbackUrl ?? "/login";
}
