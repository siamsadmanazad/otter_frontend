import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "@/lib/api/http";

/**
 * Durable rate limiting backed by the `rate_limit_hit` Postgres RPC (one source of
 * truth across serverless instances). **Fail-open**: any limiter error (incl. the RPC
 * not yet existing on an env) returns "allowed" so legit users are never blocked.
 */
export async function isAllowed(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail-open
    return data === true;
  } catch {
    return true; // fail-open
  }
}

/** Build a limit key from a route label + the caller (userId preferred, else IP). */
export function limitKey(
  route: string,
  userId: string | null | undefined,
  req: NextRequest
): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${route}:${userId || ip || "anon"}`;
}

/**
 * Convenience guard for route handlers:
 *   const limited = await enforceRateLimit("comment", userId, req, 5, 60);
 *   if (limited) return limited;   // 429
 * Returns a 429 Response when over the limit, otherwise null.
 */
export async function enforceRateLimit(
  route: string,
  userId: string | null | undefined,
  req: NextRequest,
  limit: number,
  windowSeconds: number
): Promise<Response | null> {
  const ok = await isAllowed(limitKey(route, userId, req), limit, windowSeconds);
  if (ok) return null;
  return fail("Too many requests. Please slow down and try again shortly.", 429);
}
