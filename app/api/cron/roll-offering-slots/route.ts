import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError, timeRoute } from "@/lib/observability";

// GET /api/cron/roll-offering-slots — Vercel Cron only (see vercel.json).
//
// bussinesstemplate.md C.3. Availability rules describe an open-ended pattern
// ("every Friday"), which is infinite; slots are materialised 180 days out and
// this rolls that horizon forward each night. Without it a host's calendar
// quietly runs dry six months after they set it up — a failure that would only
// surface as travellers finding nothing to book.
//
// Also drops past slots nobody booked. Booked past slots are KEPT: they are
// the attendance record Phase D's COMPLETED transition and Phase F's reviews
// both depend on.
//
// Safe to run twice: materialize_offering_slots() is idempotent by
// construction (unique start + ON CONFLICT DO NOTHING), so a retried or
// double-fired cron changes nothing.
export const GET = timeRoute("cron.rollOfferingSlots", async (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    captureRouteError("roll-offering-slots: CRON_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data, error } = await db.rpc("materialize_all_offering_slots", {
    p_horizon_days: 180,
  });

  if (error) {
    captureRouteError(`roll-offering-slots: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slotsCreated: Number(data ?? 0) });
});
