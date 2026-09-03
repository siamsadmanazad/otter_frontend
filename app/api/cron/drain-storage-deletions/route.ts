import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError, timeRoute } from "@/lib/observability";
import { providerFor } from "@/lib/storage";

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
    .select("id, bucket, path, provider")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (fetchErr) {
    captureRouteError("drain-storage-deletions: fetch failed", { error: fetchErr.message });
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!batch || batch.length === 0) {
    return NextResponse.json({ drained: 0 });
  }

  // Grouped by (provider, bucket): a queued object must be deleted from the
  // store it actually lives on, which after the R2 cutover is not necessarily
  // the store new uploads go to. Getting this wrong leaks bytes silently --
  // MEDIA.md §8 flags it as the fastest path to a surprise bill.
  const byBucket = new Map<string, { provider: string; bucket: string; ids: number[]; paths: string[] }>();
  // Cast: `provider` is new in 20260903220000_media_provider.sql and the
  // checked-in generated types predate it.
  const rows = batch as unknown as Array<{
    id: number;
    bucket: string;
    path: string;
    provider: string | null;
  }>;
  for (const row of rows) {
    const provider = row.provider ?? "supabase";
    const key = `${provider}:${row.bucket}`;
    const group = byBucket.get(key) ?? { provider, bucket: row.bucket, ids: [], paths: [] };
    group.ids.push(row.id);
    group.paths.push(row.path);
    byBucket.set(key, group);
  }

  let drained = 0;
  const failures: string[] = [];
  for (const [key, { provider, bucket, ids, paths }] of byBucket) {
    // Best-effort per group: a failure removing one group's batch (e.g. an
    // already-gone object) shouldn't block the others' rows from draining.
    try {
      await providerFor(provider).remove(bucket, paths);
    } catch (e) {
      failures.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const { error: delErr } = await db.from("pending_storage_deletions").delete().in("id", ids);
    if (delErr) {
      failures.push(`${key} (queue row delete): ${delErr.message}`);
      continue;
    }
    drained += ids.length;
  }

  if (failures.length) {
    captureRouteError("drain-storage-deletions: partial failure", { failures });
  }

  return NextResponse.json({ drained, remaining: batch.length - drained, failures });
});
