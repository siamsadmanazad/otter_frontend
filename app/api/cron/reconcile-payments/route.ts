import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError, timeRoute } from "@/lib/observability";
import { logPaymentEvent } from "@/lib/payments/audit";
import {
  decimalStringToMinor,
  isPaidStatus,
  isRefundInFlightStatus,
  isRefundSettledStatus,
  refundApiAnswered,
  sslcommerzConfig,
  sslcommerzInitiateRefund,
  sslcommerzQueryByTranId,
  sslcommerzRefundQuery,
  sslcommerzValidate,
} from "@/lib/payments/sslcommerz";
import type { SslcommerzConfig } from "@/lib/payments/sslcommerz";

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

  const refunds = await sweepUnsettledRefunds(db, cfg);

  return NextResponse.json({
    ok: true,
    scanned: stuck.length,
    confirmed,
    failed,
    expired,
    stillPending,
    errors,
    refunds,
  });
});

// ════════════════════════════════════════════════════════════════════════════
// E.7 · the refund half of the same sweep
// ════════════════════════════════════════════════════════════════════════════
// ⚠️ WHY THIS LIVES HERE AND NOT IN ITS OWN CRON FILE.
// SSLCommerz's refund API answers `processing` for a refund it has accepted
// but not settled, so E.7 has exactly the problem E.6 was built for, pointed
// the other way: a money movement whose outcome arrives later than the call
// that started it, with no callback. A second cron route would duplicate this
// file's CRON_SECRET check, its config load, its "APIConnect is a separate
// question from status" discipline and its captureRouteError plumbing, to run
// one more loop against the same host on the same schedule — and the two would
// then drift, which is the "change one, change all three" shape B.6 already
// had to write a warning about.
//
// The 15-minute cadence suits both. Nothing here is time-critical the way the
// payment sweep is (there, frequency is the difference between recovering a
// payment and owing one back); a refund settling 15 minutes late costs a guest
// nothing but a refresh.
//
// TWO KINDS OF ROW ARE PICKED UP:
//
//   PROCESSING  the gateway accepted it and gave us a refund_ref_id.
//               inquiryRefund tells us whether it settled.
//
//   INITIATED   we never got a usable answer at all — the refund route found
//               the gateway unreachable, or APIConnect was not DONE, or the
//               process died between refund_booking() and the gateway call.
//               ⚠️ These are the dangerous ones: we do not know whether a
//               refund exists at SSLCommerz. Re-initiating blind could refund
//               twice. So an INITIATED row is re-initiated with the SAME
//               refe_id — our own idempotency handle, which is precisely what
//               refe_id is for — and only after a grace period long enough
//               that an in-flight first attempt has certainly finished.

const REFUND_STUCK_AFTER_MINUTES = 15;
const REFUND_MAX_PER_RUN = 25;
// A refund the gateway has never resolved after this long is not settling on
// its own. It stays PROCESSING (never silently FAILED — the money may well
// have moved) and is escalated to a human instead.
const REFUND_ESCALATE_AFTER_HOURS = 24;

interface UnsettledRefund {
  id: string;
  booking_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  refe_id: string;
  provider_refund_ref_id: string | null;
  reason: string | null;
  created_at: string;
}

async function sweepUnsettledRefunds(
  db: ReturnType<typeof createAdminClient>,
  cfg: SslcommerzConfig
): Promise<{ scanned: number; settled: number; stillProcessing: number; failed: number; errors: number }> {
  const cutoff = new Date(Date.now() - REFUND_STUCK_AFTER_MINUTES * 60_000).toISOString();
  const escalateBefore = new Date(
    Date.now() - REFUND_ESCALATE_AFTER_HOURS * 3_600_000
  ).toISOString();

  const { data, error } = await db
    .from("payment_refunds")
    .select(
      "id, booking_id, amount_minor, currency, status, refe_id, provider_refund_ref_id, reason, created_at"
    )
    .in("status", ["INITIATED", "PROCESSING"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(REFUND_MAX_PER_RUN);

  if (error) {
    captureRouteError(`reconcile-refunds: ${error.message}`);
    return { scanned: 0, settled: 0, stillProcessing: 0, failed: 0, errors: 1 };
  }

  const rows = (data ?? []) as UnsettledRefund[];
  let settled = 0;
  let stillProcessing = 0;
  let failed = 0;
  let errors = 0;

  // The refund's own tran_id, for the audit rows. payment_events keys on
  // tran_id, and a refund's audit trail belongs next to the payment it
  // reverses rather than floating unattached.
  const tranIdFor = async (bookingId: string): Promise<string | null> => {
    const { data: intent } = await db
      .from("payment_intents")
      .select("tran_id")
      .eq("booking_id", bookingId)
      .eq("status", "VALID")
      .maybeSingle();
    return intent?.tran_id ?? null;
  };

  for (const refund of rows) {
    try {
      const tranId = await tranIdFor(refund.booking_id);

      // ── Case 1: we hold a provider ref. Ask what happened to it. ─────────
      let answer;
      if (refund.provider_refund_ref_id) {
        answer = await sslcommerzRefundQuery(cfg, refund.provider_refund_ref_id);
      } else {
        // ── Case 2: no provider ref. We never got a usable answer. ────────
        // Re-initiate with the SAME refe_id. If a first attempt did land at
        // SSLCommerz, they have already seen this reference; if it did not,
        // this is the first real one. Either way it is ONE refund, which is
        // the whole reason payment_refunds.refe_id is unique and frozen.
        const { data: intent } = await db
          .from("payment_intents")
          .select("provider_bank_tran_id")
          .eq("booking_id", refund.booking_id)
          .eq("status", "VALID")
          .maybeSingle();
        const bankTranId = (intent?.provider_bank_tran_id ?? "").trim();
        if (!bankTranId) {
          errors++;
          await logPaymentEvent({
            tranId,
            eventType: "REFUND_FAILED",
            note: `Sweep: refund ${refund.refe_id} has no bank_tran_id to retry against — needs a human`,
          });
          captureRouteError(`reconcile-refunds: no bank_tran_id for ${refund.refe_id}`);
          continue;
        }
        const call = await sslcommerzInitiateRefund(cfg, {
          bankTranId,
          amountMinor: Number(refund.amount_minor),
          remarks: refund.reason || `Booking refund ${refund.refe_id}`,
          refeId: refund.refe_id,
        });
        answer = call.result;
      }

      // ── APIConnect first, always. It is a different question. ────────────
      if (!refundApiAnswered(answer)) {
        stillProcessing++;
        await logPaymentEvent({
          tranId,
          eventType: "REFUND_PROCESSING",
          note: `Sweep: APIConnect=${answer.apiConnect || "(none)"} — learned nothing, left untouched`,
        });
        continue;
      }

      // ── Settled ──────────────────────────────────────────────────────────
      if (isRefundSettledStatus(answer.status)) {
        const providerRef = answer.refundRefId || refund.provider_refund_ref_id || "";
        if (!providerRef) {
          errors++;
          await logPaymentEvent({
            tranId,
            eventType: "REFUND_FAILED",
            payload: answer.raw,
            note: `Sweep: settled but no refund_ref_id to record — cannot complete (payment_refunds_ref_id_chk)`,
          });
          continue;
        }
        const { data: done, error: rpcErr } = await db.rpc("complete_booking_refund", {
          p_refund_id: refund.id,
          p_provider_ref: providerRef,
          p_response: answer.raw as never,
        });
        if (rpcErr) {
          errors++;
          await logPaymentEvent({
            tranId,
            eventType: "REFUND_FAILED",
            payload: answer.raw,
            note: `⚠️ Sweep: gateway settled but complete_booking_refund failed: ${(rpcErr.message ?? "").trim()}`,
          });
          captureRouteError(`reconcile-refunds: complete failed for ${refund.refe_id}`);
          continue;
        }
        settled++;
        await logPaymentEvent({
          tranId,
          eventType: "REFUND_SUCCEEDED",
          payload: { gateway: answer.raw, result: done },
          note: `Sweep settled a refund the route left unfinished · ${refund.amount_minor} ${refund.currency} minor`,
        });
        continue;
      }

      // ── Still in flight ──────────────────────────────────────────────────
      if (isRefundInFlightStatus(answer.status)) {
        stillProcessing++;
        // A first-attempt row that has now been accepted: record the provider
        // ref so the next run can inquire rather than re-initiate.
        if (!refund.provider_refund_ref_id && answer.refundRefId) {
          await db
            .from("payment_refunds")
            .update({
              status: "PROCESSING",
              provider_refund_ref_id: answer.refundRefId,
              requested_at: new Date().toISOString(),
              response_payload: answer.raw as never,
            })
            .eq("id", refund.id)
            .in("status", ["INITIATED", "PROCESSING"]);
        }
        if (refund.created_at < escalateBefore) {
          // ⚠️ NOT marked FAILED. After 24 hours we still do not know that the
          // money did not move, and recording a refund as failed when it may
          // have succeeded is how a guest gets refunded twice. Escalate.
          await logPaymentEvent({
            tranId,
            eventType: "REFUND_PROCESSING",
            payload: answer.raw,
            note: `⚠️ Refund ${refund.refe_id} unresolved after ${REFUND_ESCALATE_AFTER_HOURS}h — left PROCESSING, needs a human`,
          });
          captureRouteError(`reconcile-refunds: ${refund.refe_id} unresolved >24h`);
        }
        continue;
      }

      // ── Refused ──────────────────────────────────────────────────────────
      await db
        .from("payment_refunds")
        .update({
          status: "FAILED",
          provider_refund_ref_id: answer.refundRefId || refund.provider_refund_ref_id,
          requested_at: new Date().toISOString(),
          failed_at: new Date().toISOString(),
          response_payload: answer.raw as never,
        })
        .eq("id", refund.id)
        .in("status", ["INITIATED", "PROCESSING"]);
      failed++;
      await logPaymentEvent({
        tranId,
        eventType: "REFUND_FAILED",
        payload: answer.raw,
        note: `Sweep: gateway refused · status=${answer.status || "(none)"} reason=${answer.errorReason || "(none)"} — the guest is still owed money (I.2)`,
      });
      captureRouteError(`reconcile-refunds: refused ${refund.refe_id}: ${answer.errorReason}`);
    } catch (e) {
      errors++;
      captureRouteError(`reconcile-refunds: ${refund.refe_id}: ${String(e)}`);
    }
  }

  return { scanned: rows.length, settled, stillProcessing, failed, errors };
}
