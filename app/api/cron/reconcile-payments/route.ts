import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError, timeRoute } from "@/lib/observability";
import { logPaymentEvent } from "@/lib/payments/audit";
import {
  decimalStringToMinor,
  isPaidStatus,
  sslcommerzConfig,
  sslcommerzQueryByTranId,
  sslcommerzValidate,
} from "@/lib/payments/sslcommerz";

// GET /api/cron/reconcile-payments — Vercel Cron only (see vercel.json).
//
// bussinesstemplate.md Phase E.6, closing hazard R-6: "dropped IPN leaves
// money taken and no booking. Assume this happens in production."
//
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ THE GAP IN E.6 AS WRITTEN, AND HOW IT IS CLOSED
// ════════════════════════════════════════════════════════════════════════════
// E.6 says a stuck intent is "re-queried against the validator API". It
// cannot be. validationserverAPI.php takes a `val_id`, and a val_id reaches
// us in exactly one place: the body of an IPN. An intent stuck PENDING is BY
// DEFINITION one for which no IPN arrived — so it has no val_id, and E.6 as
// literally specified cannot recover the one case it exists for.
//
// The recovery has to run on the only identifier we are guaranteed to hold:
// the `tran_id` we generated ourselves at init. SSLCommerz does expose that
// lookup, at a different endpoint the plan does not mention —
// merchantTransIDvalidationAPI.php. Verified live against the sandbox before
// this was written; an unknown tran_id answers
//   {"APIConnect":"DONE","no_of_trans_found":0,"element":[{...,"status":"INVALID"}]}
// which is what makes "no such transaction" distinguishable from "the API is
// down". Those two must lead to opposite decisions and a single boolean would
// have conflated them.
//
// So the sweep is: query by tran_id → if it comes back paid, take the val_id
// FROM THAT RESPONSE and run the ordinary validator call, then confirm
// through the same confirm_booking_payment() the IPN uses. The second call is
// not ceremony: it keeps ONE code path as the thing that may mark money
// received (D14/S4), so reconciliation cannot become a softer second door
// into the same state.
// ════════════════════════════════════════════════════════════════════════════
//
// ── WHAT COUNTS AS "STUCK" ──────────────────────────────────────────────────
// PENDING or INITIATED for more than 15 minutes (E.1's own
// payment_intents_stuck_idx is partial on exactly those two statuses, so this
// scans a handful of rows, never the table).
//
// Deliberately runs every 15 minutes rather than hourly: create_booking()
// gives a PENDING_PAYMENT booking a 15-minute hold, and D.5's expiry cron
// reclaims the seat after that. A reconciliation that ran hourly would
// routinely find payments whose bookings had already expired —
// confirm_booking_payment() then refuses with CONFIRM_BOOKING_GONE and the
// guest needs a manual refund. Frequency here is not tuning, it is the
// difference between recovering a payment and owing one back.

const STUCK_AFTER_MINUTES = 15;
// A hard ceiling per run. A backlog is a signal, not something to grind
// through in one 60-second serverless invocation — the next run picks up
// where this one stopped, oldest first.
const MAX_PER_RUN = 50;
// After this long with no answer from the gateway, an intent is not "in
// flight", it is abandoned. 24h is well past any real settlement delay and
// well past the guest's own booking hold, so expiring it frees the
// one-live-intent slot for a fresh checkout without risking a race with a
// payment that is genuinely still settling.
const GIVE_UP_AFTER_HOURS = 24;

interface StuckIntent {
  id: string;
  booking_id: string;
  tran_id: string;
  status: string;
  amount_minor: number;
  currency: string;
  created_at: string;
}

export const GET = timeRoute("cron.reconcilePayments", async (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    captureRouteError("reconcile-payments: CRON_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = sslcommerzConfig();
  if (!cfg) {
    // Not an error on an environment with no gateway configured — there is
    // nothing to reconcile against, and a 500 here would page someone nightly.
    return NextResponse.json({ ok: true, skipped: "SSLCommerz not configured" });
  }

  const db = createAdminClient();
  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  const giveUpBefore = new Date(Date.now() - GIVE_UP_AFTER_HOURS * 3_600_000).toISOString();

  const { data, error } = await db
    .from("payment_intents")
    .select("id, booking_id, tran_id, status, amount_minor, currency, created_at")
    .in("status", ["INITIATED", "PENDING"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    captureRouteError(`reconcile-payments: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stuck = (data ?? []) as StuckIntent[];
  let confirmed = 0;
  let failed = 0;
  let expired = 0;
  let stillPending = 0;
  let errors = 0;

  for (const intent of stuck) {
    try {
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId: intent.tran_id,
        eventType: "RECONCILE_REQUESTED",
        note: `Stuck in ${intent.status} since ${intent.created_at}`,
      });

      const query = await sslcommerzQueryByTranId(cfg, intent.tran_id);

      // The API itself is unwell. Change nothing — an intent left alone is
      // recoverable on the next run; an intent wrongly expired because a
      // lookup timed out is a payment we may never reconcile.
      if (query.apiConnect.toUpperCase() !== "DONE") {
        stillPending++;
        await logPaymentEvent({
          paymentIntentId: intent.id,
          tranId: intent.tran_id,
          eventType: "IPN_REJECTED",
          note: `Reconcile: APIConnect=${query.apiConnect || "(none)"} — left untouched`,
        });
        continue;
      }

      // Prefer a paid element; the endpoint returns every attempt against
      // this tran_id and a guest who retried inside one session can produce
      // more than one.
      const paidElement = query.elements.find((e) => isPaidStatus(e.status));

      // ── Nothing paid ────────────────────────────────────────────────────
      if (!paidElement) {
        if (intent.created_at < giveUpBefore) {
          await db
            .from("payment_intents")
            .update({ status: "EXPIRED", closed_at: new Date().toISOString() })
            .eq("id", intent.id)
            .in("status", ["INITIATED", "PENDING"]);
          expired++;
          await logPaymentEvent({
            paymentIntentId: intent.id,
            tranId: intent.tran_id,
            eventType: "RECONCILE_EXPIRED",
            payload: query.raw,
            note: `No paid transaction after ${GIVE_UP_AFTER_HOURS}h (found ${query.count})`,
          });
        } else {
          stillPending++;
        }
        continue;
      }

      // ── Paid. Re-verify through the SAME authority the IPN uses ─────────
      // The tran_id query's own `status` is not treated as sufficient: D14
      // names the validator API as the thing that may confirm a payment, and
      // having two endpoints able to unlock the same state means two places
      // to get it wrong. The val_id we need comes out of the query response.
      if (!paidElement.valId) {
        errors++;
        await logPaymentEvent({
          paymentIntentId: intent.id,
          tranId: intent.tran_id,
          eventType: "IPN_REJECTED",
          payload: query.raw,
          note: "Reconcile: paid element carries no val_id — cannot validate, left untouched",
        });
        continue;
      }

      const validation = await sslcommerzValidate(cfg, paidElement.valId);

      const paidMinor = decimalStringToMinor(validation.amount);
      const checks: string[] = [];
      if (!isPaidStatus(validation.status)) checks.push(`status=${validation.status}`);
      if (validation.tranId !== intent.tran_id) checks.push(`tran_id=${validation.tranId}`);
      if (paidMinor === null) checks.push(`amount=${validation.amount}`);
      else if (paidMinor !== Number(intent.amount_minor)) {
        checks.push(`amount ${paidMinor} != ${intent.amount_minor}`);
      }
      if (validation.currency.trim().toUpperCase() !== String(intent.currency).toUpperCase()) {
        checks.push(`currency=${validation.currency}`);
      }

      if (checks.length > 0) {
        // The tran_id query said paid and the validator disagrees. Do not
        // guess: close the intent so the guest can start again, and record
        // exactly which assertions failed for a human to read.
        await db
          .from("payment_intents")
          .update({ status: "FAILED", closed_at: new Date().toISOString() })
          .eq("id", intent.id)
          .in("status", ["INITIATED", "PENDING"]);
        failed++;
        await logPaymentEvent({
          paymentIntentId: intent.id,
          tranId: intent.tran_id,
          eventType: "IPN_REJECTED",
          payload: { query: query.raw, validator: validation.raw },
          note: `Reconcile rejected: ${checks.join("; ")}`,
        });
        continue;
      }

      const { data: result, error: rpcErr } = await db.rpc("confirm_booking_payment", {
        p_booking_id: intent.booking_id,
        p_tran_id: intent.tran_id,
        p_val_id: validation.valId || paidElement.valId,
        p_bank_tran_id: validation.bankTranId || paidElement.bankTranId,
        p_gross_minor: paidMinor,
      });

      if (rpcErr) {
        const msg = rpcErr.message ?? "";
        errors++;
        const gone =
          msg.includes("CONFIRM_BOOKING_GONE") || msg.includes("CONFIRM_BOOKING_ALREADY_PAID");
        await logPaymentEvent({
          paymentIntentId: intent.id,
          tranId: intent.tran_id,
          eventType: "IPN_REJECTED",
          payload: { validator: validation.raw },
          note: gone
            ? `⚠️ MONEY TAKEN, BOOKING UNAVAILABLE (${msg.trim()}) — needs a manual refund (E.7)`
            : `Reconcile confirm failed: ${msg}`,
        });
        if (gone) captureRouteError(`reconcile: paid but unbookable: ${intent.tran_id}`);
        continue;
      }

      confirmed++;
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId: intent.tran_id,
        eventType: "RECONCILED",
        payload: { validator: validation.raw, result },
        note: `Recovered a payment with no IPN (R-6) · ${paidMinor} ${validation.currency}`,
      });
    } catch (e) {
      errors++;
      captureRouteError(`reconcile-payments: ${intent.tran_id}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stuck.length,
    confirmed,
    failed,
    expired,
    stillPending,
    errors,
  });
});
