import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// bussinesstemplate.md Phase E.8 — the read half of "an admin-only export".
//
// GET /api/business/payouts?currency=BDT&page=&limit=
//
// ⚠️ READ-ONLY, AND DELIBERATELY SO. E.8's row asks for "an admin-only export
// of net host earnings per period", but D20/I.1's `platform_role` does not
// exist yet — there is no site-admin concept anywhere in this codebase. So this
// route is the half that IS buildable today: a business seeing its OWN money.
// Creating a batch and marking it paid are service-role-only DB functions with
// no route at all, on purpose — no client, not even the FOUNDER being paid, may
// trigger their own payout. See 20260903080000_payout_batches.sql's header.
//
// No businessId in the request: it targets user.profileId, the same convention
// /api/business/analytics and /api/business/staff already use. RLS
// (payout_batches_select_own / payout_items_select_own, both
// business_id = current_profile_id()) is the actual gate, reached through the
// actor client — a caller who is not acting as a business simply gets an empty
// list and zeros, which is the correct answer rather than an error.

interface PayoutItemRow {
  payout_batch_id: string;
  booking_id: string;
  booking_code: string;
  offering_title: string | null;
  gross_minor: number;
  fee_minor: number;
  net_minor: number;
  entry_count: number;
}

interface PayoutBatchRow {
  id: string;
  period_start: string;
  period_end: string;
  gross_minor: number;
  fee_minor: number;
  net_minor: number;
  currency: string;
  status: string;
  payout_method: string | null;
  payout_reference: string | null;
  notes: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  failed_at: string | null;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const sp = request.nextUrl.searchParams;
    const currencyRaw = (sp.get("currency") || "BDT").toUpperCase();
    // Three letters or nothing. The DB column is char(3) and a longer value
    // would be silently truncated into a different currency.
    const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : "BDT";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10) || 20));
    const from = (page - 1) * limit;

    const db = await createActorClient(request);

    // The two totals a host asks about, and why they differ, in one call.
    // host_payout_preview is SECURITY INVOKER, so RLS answers it: a caller
    // asking about a business they are not acting as gets zeros.
    const { data: preview, error: previewError } = await db.rpc("host_payout_preview", {
      p_business_id: user.profileId,
      p_currency: currency,
    });
    if (previewError) return fail(previewError.message, 400);

    const { data: batchRows, error: batchError } = await db
      .from("payout_batches")
      .select(
        "id, period_start, period_end, gross_minor, fee_minor, net_minor, currency, status, " +
          "payout_method, payout_reference, notes, failure_reason, created_at, paid_at, failed_at",
      )
      .eq("currency", currency)
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);
    if (batchError) return fail(batchError.message, 500);

    // `as unknown as`: there is no generated Database type in this repo, so
    // supabase-js falls back to GenericStringError[] for a table it cannot name.
    // Same idiom as /api/payments/[tranId]/refund.
    const batches = (batchRows ?? []) as unknown as PayoutBatchRow[];

    // One query for every batch's items rather than one per batch: a host with
    // a year of monthly payouts should not cost twelve round trips to render.
    let items: PayoutItemRow[] = [];
    if (batches.length > 0) {
      const { data: itemRows, error: itemError } = await db
        .from("payout_items")
        .select(
          "payout_batch_id, booking_id, booking_code, offering_title, " +
            "gross_minor, fee_minor, net_minor, entry_count",
        )
        .in(
          "payout_batch_id",
          batches.map((b) => b.id),
        )
        .order("booking_code", { ascending: true });
      if (itemError) return fail(itemError.message, 500);
      items = (itemRows ?? []) as unknown as PayoutItemRow[];
    }

    const byBatch = new Map<string, PayoutItemRow[]>();
    for (const item of items) {
      const list = byBatch.get(item.payout_batch_id);
      if (list) list.push(item);
      else byBatch.set(item.payout_batch_id, [item]);
    }

    const p = (preview ?? {}) as Record<string, unknown>;

    return ok(
      {
        currency,
        // Everything earned and not yet paid out, CONFIRMED bookings included.
        payableMinor: Number(p.payableMinor ?? 0),
        // The subset a payout batch could take today: finished bookings only,
        // nothing with a refund in flight. Lower than payableMinor whenever the
        // host has bookings that are paid for but not yet delivered — that gap
        // is "earned vs released", not a bug.
        batchableMinor: Number(p.batchableMinor ?? 0),
        batchableBookings: Number(p.batchableBookings ?? 0),
        batchableEntries: Number(p.batchableEntries ?? 0),
        oldestEntryAt: (p.oldestEntryAt as string | null) ?? null,
        openBatchId: (p.openBatchId as string | null) ?? null,
        lastPaidAt: (p.lastPaidAt as string | null) ?? null,
        paidToDateMinor: Number(p.paidToDateMinor ?? 0),
        batches: batches.map((b) => ({
          id: b.id,
          periodStart: b.period_start,
          periodEnd: b.period_end,
          grossMinor: b.gross_minor,
          feeMinor: b.fee_minor,
          netMinor: b.net_minor,
          currency: b.currency,
          status: b.status,
          payoutMethod: b.payout_method,
          payoutReference: b.payout_reference,
          notes: b.notes,
          failureReason: b.failure_reason,
          createdAt: b.created_at,
          paidAt: b.paid_at,
          failedAt: b.failed_at,
          items: (byBatch.get(b.id) ?? []).map((i) => ({
            bookingId: i.booking_id,
            bookingCode: i.booking_code,
            offeringTitle: i.offering_title,
            grossMinor: i.gross_minor,
            feeMinor: i.fee_minor,
            netMinor: i.net_minor,
            entryCount: i.entry_count,
          })),
        })),
      },
      "Payouts retrieved",
    );
  } catch (e) {
    console.error("GET /api/business/payouts error:", e);
    return fail("Internal server error", 500);
  }
}
