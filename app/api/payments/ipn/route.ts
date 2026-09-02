import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowed } from "@/lib/ratelimit";
import { captureRouteError, timeRoute } from "@/lib/observability";
import { logPaymentEvent } from "@/lib/payments/audit";
import {
  decimalStringToMinor,
  isInFlightStatus,
  isPaidStatus,
  sslcommerzConfig,
  sslcommerzQueryByTranId,
  sslcommerzValidate,
} from "@/lib/payments/sslcommerz";

// bussinesstemplate.md Phase E.4 · POST /api/payments/ipn
// ⚠️ THE SECURITY KEYSTONE. Read §8 S4/S5/S13 and D14 before editing.
//
// ── WHY THIS ROUTE IS PUBLIC, AND WHY THAT IS FINE ──────────────────────────
// SSLCommerz has no session with us; it posts from its own servers. So there
// is no getServerUser() call here and there cannot be one. The route is
// therefore designed on the assumption that ANYONE can POST anything to it —
// and the defence is not authentication but the fact that nothing in the
// request body is ever believed. The only thing a POST here can do is cause
// us to ASK SSLCommerz a question (the validator API, server to server, with
// our own credentials); the answer to that question is what decides
// everything. A forged body can waste one outbound HTTP call. It cannot
// confirm a booking, because the confirmation path runs on the validator's
// numbers, not the body's.
//
// ── THE ORDER OF OPERATIONS, AND WHY ────────────────────────────────────────
//   1. Parse form-encoded body (SSLCommerz posts x-www-form-urlencoded, NOT
//      JSON — request.json() here silently sees nothing).
//   2. Log IPN_RECEIVED with the raw payload, BEFORE any validation. S5 says
//      record every delivery, and the deliveries most worth having are the
//      ones we are about to reject.
//   3. Resolve the intent by tran_id. Unknown → orphan, logged, 200.
//   4. Already VALID → replay, 200, nothing written.
//   5. Ask the validator API with val_id. THIS is the authority (D14).
//   6. Assert status / tran_id / amount / currency / store_id, in that order.
//   7. confirm_booking_payment() — one transaction (see the migration).
//
// ── WHY EVERY OUTCOME IS 200 ────────────────────────────────────────────────
// A rejection is a normal outcome of this route working correctly, not a
// server error. Returning 500 on a rejection would make SSLCommerz retry a
// delivery we have already correctly decided against, forever, and would
// bury real failures in the noise. 500 is reserved for the two things that
// genuinely are our fault: the database being unreachable, and the validator
// API being unreachable — in the second case a retry is exactly what we want.
//
// The 200 body is a bare acknowledgement with no reason in it. Telling a
// prober WHICH assertion their forgery tripped is a free oracle for the next
// attempt (E.1's payment_events lockdown makes the same argument). The reason
// goes to payment_events, where only an operator can read it.

const ACK = "OK";

function ack(): Response {
  return new NextResponse(ACK, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const POST = timeRoute("payments.ipn", async (request: NextRequest) => {
  let tranId = "";
  try {
    const cfg = sslcommerzConfig();

    // ── Parse ───────────────────────────────────────────────────────────
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      await logPaymentEvent({
        eventType: "IPN_REJECTED",
        note: "Unparseable body (not form-encoded)",
      });
      return ack();
    }

    const field = (k: string): string => {
      const v = form.get(k);
      return typeof v === "string" ? v : "";
    };
    const payload: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") payload[k] = v.length > 4000 ? v.slice(0, 4000) : v;
    }

    tranId = field("tran_id").trim();
    const valId = field("val_id").trim();

    // ── S13: rate limit, per tran_id, NOT per IP ────────────────────────
    // SSLCommerz retries from its own infrastructure, whose addresses we do
    // not control and should not pin; an IP limit would throttle legitimate
    // retries for every merchant transaction at once the moment they add a
    // node. A per-tran_id budget is the shape that actually matches the
    // threat: hammering this route means hammering one transaction, and 60
    // deliveries for one tran_id in five minutes is far beyond any real
    // retry schedule while leaving a flood of DISTINCT forged ids to be
    // absorbed by the orphan path, which writes one small audit row and
    // makes no outbound call at all.
    const limitSubject = tranId || "no-tran-id";
    const allowed = await isAllowed(`payments_ipn:${limitSubject}`, 60, 300);
    if (!allowed) {
      await logPaymentEvent({
        tranId: tranId || null,
        eventType: "IPN_REJECTED",
        note: "Rate limited",
      });
      return ack();
    }

    const db = createAdminClient();

    // ── Resolve the intent (needed to key the receipt row) ──────────────
    let intent: {
      id: string;
      booking_id: string;
      tran_id: string;
      status: string;
      amount_minor: number;
      currency: string;
    } | null = null;

    if (tranId) {
      const { data, error } = await db
        .from("payment_intents")
        .select("id, booking_id, tran_id, status, amount_minor, currency")
        .eq("tran_id", tranId)
        .maybeSingle();
      if (error) {
        // A database we cannot read is the one case where retrying helps.
        captureRouteError(`ipn: intent lookup failed: ${error.message}`);
        return NextResponse.json({ error: "Temporarily unavailable" }, { status: 500 });
      }
      intent = data;
    }

    // ── S5: the receipt, before any judgement ───────────────────────────
    await logPaymentEvent({
      paymentIntentId: intent?.id ?? null,
      tranId: tranId || null,
      eventType: "IPN_RECEIVED",
      payload,
      note: `body status=${field("status") || "(none)"} amount=${field("amount") || "(none)"}`,
    });

    const reject = async (reason: string): Promise<Response> => {
      await logPaymentEvent({
        paymentIntentId: intent?.id ?? null,
        tranId: tranId || null,
        eventType: "IPN_REJECTED",
        note: reason,
      });
      return ack();
    };

    if (!cfg) {
      captureRouteError("ipn: SSLCommerz not configured");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    // ── Orphan: a tran_id we never issued ───────────────────────────────
    // Not our transaction, nothing to do, and emphatically not a 500 — a
    // forged delivery is not a server fault. One audit row (E.1 indexes
    // exactly this slice with payment_events_orphan_idx) and an ack.
    if (!tranId) return reject("Orphan: no tran_id in body");
    if (!intent) return reject("Orphan: no intent for this tran_id");

    // ── S5: replay ──────────────────────────────────────────────────────
    // Already validated. SSLCommerz retries; E.6 can race a late IPN. Ack
    // and write nothing further — no validator call, no RPC, no state.
    if (intent.status === "VALID") {
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId,
        eventType: "IPN_VALIDATED",
        note: "Replay: intent already VALID, no state changed",
      });
      return ack();
    }

    // ── D14/S4: ASK THE VALIDATOR. Everything above was bookkeeping. ────
    // The body's own `status` and `amount` are a hint that something
    // happened, and are used for nothing else. Without a val_id there is
    // nothing to ask with, so a body claiming success without one is
    // exactly the forgery this check exists for.
    if (!valId) return reject("No val_id in body (cannot validate — body alone is never trusted)");

    let validation;
    try {
      validation = await sslcommerzValidate(cfg, valId);
    } catch (e) {
      // Unreachable validator. Do NOT mark the intent FAILED: we have
      // learned nothing about the payment, and a guest whose money moved
      // must not have their intent closed because our outbound call timed
      // out. Leave it PENDING (E.6 will re-query by tran_id) and return
      // 500 so SSLCommerz retries — the one place a retry genuinely helps.
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId,
        eventType: "IPN_REJECTED",
        note: `Validator unreachable: ${String(e)}`,
      });
      captureRouteError(`ipn: validator unreachable for ${tranId}`);
      return NextResponse.json({ error: "Validator unavailable" }, { status: 500 });
    }

    // From here the ONLY numbers that matter are validation.*.
    // ── Assertion 1: the validator says paid ────────────────────────────
    if (!isPaidStatus(validation.status)) {
      // ⚠️ FOUND BY TESTING, NOT BY READING. The obvious handling here is to
      // close the intent (FAILED + closed_at) so the guest can start a fresh
      // checkout, and that is what this route did first. Posting a forged IPN
      // with a real tran_id and a made-up val_id then produced, correctly, a
      // rejection — and, incorrectly, moved a live PENDING intent to FAILED.
      //
      // Two things are wrong with that. It is a denial of service on a guest
      // who is at that moment on the gateway page. And it is worse than a
      // DoS: closing the intent frees the payment_intents_one_live_idx slot,
      // so the guest's next "Pay now" opens a SECOND payable gateway session
      // while the first page is still live — precisely the two-payable-
      // sessions hazard E.1 added that index to make impossible. An attacker
      // who can guess or observe one tran_id could manufacture it.
      //
      // The fix is to require corroboration before closing. A validator
      // "INVALID_TRANSACTION" answers a question about a val_id, and a
      // made-up val_id gets that answer whether or not the guest's real
      // payment is in flight — so it says nothing about the TRANSACTION. The
      // tran_id query does: it reports every attempt SSLCommerz has seen
      // against our own transaction id. no_of_trans_found = 0 with a healthy
      // APIConnect means the gateway has never seen this transaction, i.e.
      // there is nothing here to close and the delivery was fabricated.
      //
      // ⚠️ AND THE SECOND ROUND OF THE SAME LESSON. "no_of_trans_found > 0"
      // was the first version of this check and it is ALSO wrong: SSLCommerz
      // records a transaction the moment an init session is created, so a
      // guest who is at that very moment on the payment page already counts.
      // Re-running the forgery against that version still closed the live
      // intent — the query answered "yes I know this transaction", which was
      // never the question.
      //
      // The real question is whether the gateway considers it FINISHED. An
      // unpaid live session reports status "PROCESSING" (observed, not
      // documented — see isInFlightStatus). So the intent is closed only when
      // the gateway knows the transaction AND reports every attempt against
      // it as terminal and unpaid.
      //
      // Cost: one extra outbound call, on the rejection path only.
      let corroborated = false;
      let observed = "";
      try {
        const q = await sslcommerzQueryByTranId(cfg, intent.tran_id);
        observed = q.elements.map((e) => e.status || "(blank)").join(",") || "(none)";
        corroborated =
          q.apiConnect.toUpperCase() === "DONE" &&
          q.count > 0 &&
          q.elements.length > 0 &&
          !q.elements.some((e) => isInFlightStatus(e.status) || isPaidStatus(e.status));
      } catch {
        // Could not ask. Leave the intent alone — E.6 re-queries by tran_id
        // and will settle it. Never close a live session on a failed lookup.
        corroborated = false;
        observed = "(query failed)";
      }

      if (corroborated) {
        // A real attempt exists against this transaction and it did not
        // succeed. FAILED (not CANCELLED/EXPIRED) because the gateway
        // answered and the answer was not "paid" — CANCELLED is the guest's
        // own word and EXPIRED is E.6's.
        await db
          .from("payment_intents")
          .update({ status: "FAILED", closed_at: new Date().toISOString() })
          .eq("id", intent.id)
          .in("status", ["INITIATED", "PENDING"]);
        return reject(
          `Validator status=${validation.status || "(none)"}; gateway reports terminal [${observed}] — intent closed`
        );
      }
      return reject(
        `Validator status=${validation.status || "(none)"} but gateway reports [${observed}] — intent left LIVE (unpaid session still in flight, or a forged IPN)`
      );
    }

    // ── Assertion 2: it is OUR transaction ──────────────────────────────
    if (validation.tranId !== intent.tran_id) {
      return reject(`Validator tran_id ${validation.tranId} != intent ${intent.tran_id}`);
    }

    // ── Assertion 3: the amount, in integer poisha ──────────────────────
    // decimalStringToMinor is a strict regex + integer maths, never
    // parseFloat: "500.00" -> 50000, and anything that is not a plain
    // 2-decimal amount is null rather than a number that looks close.
    const paidMinor = decimalStringToMinor(validation.amount);
    if (paidMinor === null) {
      return reject(`Validator amount unparseable: ${JSON.stringify(validation.amount)}`);
    }
    if (paidMinor !== Number(intent.amount_minor)) {
      return reject(`Amount ${paidMinor} != intent ${intent.amount_minor}`);
    }

    // ── Assertion 4: currency ───────────────────────────────────────────
    if (validation.currency.trim().toUpperCase() !== String(intent.currency).toUpperCase()) {
      return reject(`Currency ${validation.currency} != intent ${intent.currency}`);
    }

    // ── Assertion 5: our store ──────────────────────────────────────────
    // The validator response does not echo store_id (verified against the
    // live sandbox response shape), so the check that CAN be made is on the
    // body — and it is meaningful in exactly one direction: it cannot prove
    // a delivery is ours, but a mismatch proves it is not. The reason it is
    // safe to check a body field here is that it is the last assertion, not
    // the first: nothing has been believed on the body's word, and by this
    // point the validator has already independently confirmed the amount and
    // the transaction id against credentials only our store holds.
    const bodyStoreId = field("store_id").trim();
    if (bodyStoreId && bodyStoreId !== cfg.storeId) {
      return reject(`store_id ${bodyStoreId} != ours`);
    }

    // ── The cheap cross-check that is never an authority ────────────────
    // value_a carries the intent id we sent at init. A mismatch does not
    // reject (it is as forgeable as the rest of the body, and the validator
    // has already spoken) but it means something is wrong that nobody has
    // noticed, so it goes into the audit trail loudly.
    const echoedIntentId = field("value_a").trim();
    if (echoedIntentId && echoedIntentId !== intent.id) {
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId,
        eventType: "IPN_REJECTED",
        note: `⚠️ value_a ${echoedIntentId} != intent ${intent.id} — proceeding on validator authority, but investigate`,
      });
    }

    // ── S4/S6: one transaction, in Postgres ─────────────────────────────
    const { data: confirmed, error: rpcErr } = await db.rpc("confirm_booking_payment", {
      p_booking_id: intent.booking_id,
      p_tran_id: intent.tran_id,
      p_val_id: validation.valId || valId,
      p_bank_tran_id: validation.bankTranId || field("bank_tran_id"),
      p_gross_minor: paidMinor,
    });

    if (rpcErr) {
      const msg = rpcErr.message ?? "";
      // CONFIRM_BOOKING_GONE and CONFIRM_BOOKING_ALREADY_PAID are the two
      // outcomes where real money has moved and no booking can absorb it.
      // They are not retryable and they are not silent: they need a human
      // and, once E.7 exists, a refund.
      if (msg.includes("CONFIRM_BOOKING_GONE") || msg.includes("CONFIRM_BOOKING_ALREADY_PAID")) {
        await logPaymentEvent({
          paymentIntentId: intent.id,
          tranId,
          eventType: "IPN_REJECTED",
          payload: { validator: validation.raw },
          note: `⚠️ MONEY TAKEN, BOOKING UNAVAILABLE (${msg.trim()}) — needs a manual refund (E.7)`,
        });
        captureRouteError(`ipn: paid but unbookable: ${tranId} ${msg}`, { tranId });
        return ack();
      }
      // Anything else is unexpected. 500 so SSLCommerz retries — the
      // transaction rolled back whole, so a retry is safe by construction.
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId,
        eventType: "IPN_REJECTED",
        note: `confirm_booking_payment failed: ${msg}`,
      });
      captureRouteError(`ipn: confirm_booking_payment failed: ${msg}`, { tranId });
      return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
    }

    await logPaymentEvent({
      paymentIntentId: intent.id,
      tranId,
      eventType: "IPN_VALIDATED",
      payload: { validator: validation.raw, result: confirmed },
      note: `Confirmed ${paidMinor} ${validation.currency} · risk=${validation.riskLevel}/${validation.riskTitle}`,
    });

    return ack();
  } catch (e) {
    console.error("POST /api/payments/ipn error:", e);
    captureRouteError(`ipn: unhandled: ${String(e)}`, { tranId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

// SSLCommerz posts; a GET here is somebody checking the URL is live (or a
// crawler). Answer plainly and write nothing.
export function GET(): Response {
  return new NextResponse("TripOtter payment IPN endpoint. POST only.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
