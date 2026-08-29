"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Mail, Lock } from "lucide-react";
import { signIn, signOut, useSession } from "@/lib/auth/session";

// Google Play requires an account-deletion path that works without the app
// installed (docs/play_launch_readiness.md risk 06) -- this page is that
// path. Reuses the same Supabase-backed session as the rest of the site
// (lib/auth/session.tsx), then calls the same DELETE /api/account route the
// in-app flow uses, which genuinely cascades and removes the account's data
// (verified against the route directly, not assumed).
const CONFIRM_PHRASE = "DELETE";

export function DeleteAccountPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    try {
      const result = await signIn("credentials", { redirect: false, email, password });
      if (!result.ok) {
        toast.error(result.error || "Could not sign in with those details.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.message || "Could not delete your account. Please try again.");
        return;
      }
      setDeleted(true);
      await signOut({ redirect: false });
    } catch {
      toast.error("Could not delete your account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (deleted) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl">Account deleted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-300">
              Your TripOtter account and its data have been permanently removed.
              You can close this page.
            </p>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  if (status === "loading") {
    return (
      <Centered>
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </Centered>
    );
  }

  if (status === "unauthenticated" || !session) {
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl">Delete your account</CardTitle>
            <p className="text-gray-600 dark:text-gray-300">
              Sign in to confirm which account you want to delete.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
              <Button type="submit" className="w-full h-12" disabled={signingIn}>
                {signingIn ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  const canDelete = confirmText.trim() === CONFIRM_PHRASE;

  return (
    <Centered>
      <Card className="w-full max-w-md border-red-200 dark:border-red-900">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Delete account</CardTitle>
          <p className="text-gray-600 dark:text-gray-300">
            Signed in as <strong>{session.user.email}</strong> (@{session.user.username})
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-4 text-sm text-red-800 dark:text-red-300 space-y-2">
            <p className="font-semibold">This permanently removes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your profile, posts, moments, and comments</li>
              <li>Your messages and conversations</li>
              <li>Your saved places, trails, and activity history</li>
              <li>Your OttiCash balance and transaction history</li>
            </ul>
            <p>This cannot be undone.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="h-12"
            />
          </div>
          <Button
            variant="destructive"
            className="w-full h-12"
            disabled={!canDelete || deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Permanently delete my account"}
          </Button>
          <button
            type="button"
            onClick={() => signOut({ redirect: false })}
            className="w-full text-center text-sm text-gray-500 hover:underline dark:text-gray-400"
          >
            Cancel and sign out
          </button>
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      {children}
    </div>
  );
}
