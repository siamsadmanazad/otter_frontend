/**
 * Lightweight, dependency-free error reporting.
 *
 * When `SENTRY_DSN` is set, server errors are sent to Sentry's Store endpoint over plain
 * HTTP (no SDK dependency, no bundle cost). When unset, every call is a no-op. Reporting
 * is fire-and-forget and never throws, so it can't affect a request's outcome.
 */
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
