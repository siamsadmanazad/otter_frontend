import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError, timeRoute } from "@/lib/observability";

// GET /api/cron/bookings-lifecycle — Vercel Cron only (see vercel.json).
//
// bussinesstemplate.md D.5/D.9/F.6.
//
// ── WHY THIS ROUTE DID NOT EXIST UNTIL NOW ──────────────────────────────────
// expire_stale_bookings()/complete_past_bookings()/send_booking_reminders()
// (20260902230000_bookings_lifecycle_cron.sql) were written with the comment
// "wired via a Vercel cron, mirroring C.3's roll-offering-slots pattern" —
// but no route anywhere under app/api/cron/ ever called them, and vercel.json
// never scheduled one. Confirmed by grep before writing this file. That is a
// real, live gap: complete_past_bookings() is the ONLY place a booking
// becomes COMPLETED, and COMPLETED is what Phase F's offering_reviews INSERT
// policy requires — so without this route, no ordinary user could ever
// reach a state where they're allowed to write a review, regardless of how
// correct F.1-F.5 are. F.6 needed complete_past_bookings() running for its
// own write-review screen to ever be reachable in production, so closing
// this gap is this file's job as much as wiring send_review_invites() is —
// one route, not two (matching reconcile-payments' own stated reasoning for
// staying inside an existing file rather than forking a second CRON_SECRET
// check that could drift from this one).
//
// Four sweeps, in dependency order — completion must run before the review
// invite sweep can find anything to invite, though each is independently
// safe to run in any order or skip a run entirely:
//
//   1. expire_stale_bookings()   — a hold nobody acted on in time
//   2. complete_past_bookings()  — COMPLETED is set ONLY here
//   3. send_booking_reminders()  — one "tomorrow" nudge per booking, ever
//   4. send_review_invites()     — F.6: one review invite per booking, ever,
//      fired once completed_at is >=24h in the past (F.3's window opening)
//
// Every one of the four is `for update skip locked` and idempotent by its
// own sent-marker column, so a retried or overlapping run changes nothing
// beyond what a single clean run would.
export const GET = timeRoute("cron.bookingsLifecycle", async (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    captureRouteError("bookings-lifecycle: CRON_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const result: Record<string, number> = {};

  for (const fn of [
    "expire_stale_bookings",
    "complete_past_bookings",
    "send_booking_reminders",
    "send_review_invites",
  ] as const) {
    const { data, error } = await db.rpc(fn);
    if (error) {
      captureRouteError(`bookings-lifecycle: ${fn}: ${error.message}`);
      return NextResponse.json({ error: error.message, partial: result }, { status: 500 });
    }
    result[fn] = Number(data ?? 0);
  }

  return NextResponse.json({ ok: true, ...result });
});
