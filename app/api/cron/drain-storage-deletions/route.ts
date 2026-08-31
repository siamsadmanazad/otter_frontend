import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError, timeRoute } from "@/lib/observability";

// GET /api/cron/drain-storage-deletions — Vercel Cron only (see vercel.json).
//
// sweep_orphaned_media() (pg_cron, 03:20 daily) can identify and delete
// orphaned `media` rows, but Storage bytes live outside Postgres behind the
// Storage API — pure SQL can't free them. It enqueues bucket+path into
// pending_storage_deletions instead; this route (03:40 daily, after the
// sweep) is the one place that actually calls `.storage.remove()`, using
// the same bucket-scoped call DELETE /api/media already makes.
//
// Batched (500/run): orphan volume is expected to be low and this isn't
// time-critical (a day's delay costs nothing but a little Storage spend),
// so an unfinished backlog just drains further on tomorrow's run rather
// than needing pagination inside one request.
const BATCH_SIZE = 500;

export const GET = timeRoute("cron.drainStorageDeletions", async (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    captureRouteError("drain-storage-deletions: CRON_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  // Vercel signs cron-triggered requests with this exact header.
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  const { data: batch, error: fetchErr } = await db
    .from("pending_storage_deletions")
    .select("id, bucket, path")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (fetchErr) {
    captureRouteError("drain-storage-deletions: fetch failed", { error: fetchErr.message });
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!batch || batch.length === 0) {
    return NextResponse.json({ drained: 0 });
  }

  const byBucket = new Map<string, { ids: number[]; paths: string[] }>();
  for (const row of batch) {
    const bucket = byBucket.get(row.bucket) ?? { ids: [], paths: [] };
    bucket.ids.push(row.id);
    bucket.paths.push(row.path);
    byBucket.set(row.bucket, bucket);
  }

  let drained = 0;
  const failures: string[] = [];
  for (const [bucket, { ids, paths }] of byBucket) {
    // Best-effort per bucket: a failure removing one bucket's batch (e.g. an
    // already-gone object) shouldn't block the others' rows from draining.
    const { error: rmErr } = await db.storage.from(bucket).remove(paths);
    if (rmErr) {
      failures.push(`${bucket}: ${rmErr.message}`);
      continue;
    }
    const { error: delErr } = await db.from("pending_storage_deletions").delete().in("id", ids);
    if (delErr) {
      failures.push(`${bucket} (queue row delete): ${delErr.message}`);
      continue;
    }
    drained += ids.length;
  }

  if (failures.length) {
    captureRouteError("drain-storage-deletions: partial failure", { failures });
  }

  return NextResponse.json({ drained, remaining: batch.length - drained, failures });
});
