/**
 * Diagnostic-only server-side stage timer (DM Speed Program, Step A1 —
 * otter_flutter/docs/dm_redesign.md). Not a metrics pipeline: emits one
 * structured console.log line per request so stage breakdowns are readable
 * straight out of `vercel logs` without a dashboard. Remove or leave in place
 * per Step A7 — it costs a handful of `performance.now()` calls, nothing else.
 */
export function createStageTimer(route: string) {
  const start = performance.now();
  let last = start;
  const stages: string[] = [];
  return {
    /** Record the time since the previous mark (or the timer's start) under `stage`. */
    mark(stage: string) {
      const now = performance.now();
      stages.push(`${stage}=${Math.round(now - last)}ms`);
      last = now;
    },
    /** Log the full breakdown. Call exactly once, right before returning the response. */
    finish(extra?: Record<string, unknown>) {
      const total = Math.round(performance.now() - start);
      const extraStr = extra
        ? ' ' + Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ')
        : '';
      console.log(`[chat-timing] route=${route} total=${total}ms ${stages.join(' ')}${extraStr}`);
    },
  };
}
