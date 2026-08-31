/**
 * Lightweight, dependency-free error reporting.
 *
 * When `SENTRY_DSN` is set, server errors are sent to Sentry's Store endpoint over plain
 * HTTP (no SDK dependency, no bundle cost). When unset, every call is a no-op. Reporting
 * is fire-and-forget and never throws, so it can't affect a request's outcome.
 */
import { NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function parseDsn(dsn: string) {
  // https://<publicKey>@<host>/<projectId>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, publicKey, host, projectId] = m;
  return {
    publicKey,
    url: `https://${host}/api/${projectId}/store/`,
  };
}

export function captureRouteError(
  message: string,
  context: Record<string, unknown> = {}
): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // observability disabled
  const parsed = parseDsn(dsn);
  if (!parsed) return;

  const payload = {
    message,
    level: "error",
    platform: "node",
    timestamp: Date.now() / 1000,
    environment: process.env.NODE_ENV || "production",
    extra: context,
  };

  // Fire-and-forget; swallow all errors.
  fetch(parsed.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=tripotter/1.0`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/**
 * PERFORMANCE.md Phase 0: wraps a route handler to record its duration into
 * `route_timings` (20260831140000_route_timings.sql) -- the baseline every
 * later phase's "measure before optimizing" claim has to cite. The write
 * happens via `after()`, so it runs once the response has already been sent
 * and never adds latency to the request being measured; a failed write is
 * swallowed, matching captureRouteError's own fail-open style. No SDK, no
 * new dependency -- same one-file, dependency-free posture as the rest of
 * this module.
 *
 * Usage: `export const GET = timeRoute("feed", async (request) => { ... });`
 * Works for dynamic routes too -- any extra args (e.g. `{ params }`) pass
 * through untouched.
 */
export function timeRoute<Args extends unknown[]>(
  route: string,
  handler: (request: NextRequest, ...rest: Args) => Promise<Response>
): (request: NextRequest, ...rest: Args) => Promise<Response> {
  return async (request: NextRequest, ...rest: Args): Promise<Response> => {
    const start = Date.now();
    let status = 500;
    try {
      const res = await handler(request, ...rest);
      status = res.status;
      return res;
    } finally {
      const durationMs = Date.now() - start;
      const method = request.method;
      after(() => recordTiming(route, method, status, durationMs));
    }
  };
}

async function recordTiming(
  route: string,
  method: string,
  status: number,
  durationMs: number
): Promise<void> {
  try {
    const db = createAdminClient();
    await db
      .from("route_timings")
      .insert({ route, method, status, duration_ms: durationMs });
  } catch {
    // Telemetry must never matter to anything.
  }
}
