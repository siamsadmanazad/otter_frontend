import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { captureRouteError, timeRoute } from "@/lib/observability";
import { mapBookingError } from "@/lib/api/booking-errors";
import { logPaymentEvent } from "@/lib/payments/audit";
import {
  isRefundInFlightStatus,
  isRefundSettledStatus,
  refundApiAnswered,
  sslcommerzConfig,
  sslcommerzInitiateRefund,
} from "@/lib/payments/sslcommerz";

// bussinesstemplate.md Phase E.7 · POST /api/payments/[tranId]/refund
//
// body { reason? }   — and nothing else, ever.
//
// ── ⚠️ WHY THE PATH IS [tranId] AND NOT THE DOC'S [id] ──────────────────────
// E.7 specifies `POST /api/payments/[id]/refund`. That file cannot exist:
// `app/api/payments/[tranId]/` is already there (E.5's status route), and
// Next.js refuses two different dynamic segment names at one path level. This
// is the same wall D.6 hit with GET /api/bookings/[id] vs /[code], and it is
// resolved the same way — ONE segment that accepts every identifier a caller
// might sensibly hold:
//
//     a booking UUID   ← what a host's booking inbox has (D.8)
//     a booking code   ← what a guest read out over the phone (TO-XXXXXX)
//     a tran_id        ← what the sibling status route takes, so the two
//                        routes under one segment stay usable the same way
//
// The doc's own text is ambiguous about which id it meant ("payments/[id]"
// under a payments path, but a refund is a thing a host does to a BOOKING),
// so accepting all three settles it rather than picking one and being wrong
// for half the callers.
//
// ── S3/S9 WITH THE SIGN FLIPPED ─────────────────────────────────────────────
// There is no amount field in the body and there will not be one. A host who
// could name the figure could refund 1 poisha on a 10,000-poisha booking and
// call the policy satisfied — S3's exploit, pointed outward. The amount comes
// from compute_refund_amount() inside refund_booking()'s own transaction, is
// re-bounded by payment_refunds' REFUND_EXCEEDS_PAYMENT, and re-bounded again
// by the ledger's LEDGER_REFUND_EXCEEDS_CAPTURE. An admin OVERRIDE amount is
// Phase I territory (I.1/I.2), not this route's.
//
// ── THE ORDER OF OPERATIONS, AND WHY ────────────────────────────────────────
//   1. Authenticate, rate limit, resolve the booking through the ACTOR client.
//   2. Check host-ness EXPLICITLY (S2) — RLS lets the guest see this booking
//      too, and a guest able to trigger their own refund would bypass the
//      whole policy ladder by simply always pressing the button.
//   3. refund_booking() — one transaction: validate, compute, CONFIRMED →
//      CANCELLED, write payment_refunds INITIATED. Nothing has left yet.
//   4. Ask SSLCommerz. This is the only step that is not transactional and it
//      is deliberately the LAST one before the money half, so a failure here
//      leaves a recoverable INITIATED row rather than a phantom refund.
//   5. success → complete_booking_refund() (one transaction: ledger reversal,
//      booking → REFUNDED, refund → COMPLETED).
//      processing → leave it PROCESSING; E.6's sweep polls it to resolution.
//      failed → mark FAILED, and say so plainly.
//
// ── S5: LOG EVERY ATTEMPT ───────────────────────────────────────────────────
// Unlike E.4's IPN this route is authenticated, so it does NOT need the "never
// name the failing assertion" discipline — the caller is a known host acting
// on their own booking and a useful error is the right thing to return them.
// It still writes every attempt and every outcome to payment_events, because a
// money movement with no audit row is the thing §8 exists to prevent.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKING_CODE_RE = /^TO-[0-9A-Z]{4,12}$/i;
const TRAN_ID_RE = /^[A-Za-z0-9_-]{8,30}$/;

interface RefundStarted {
  refundId: string;
  refeId: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  amountMinor: number;
  currency: string;
  refundStatus: string;
  bankTranId: string;
  tranId: string;
  hostCancelled?: boolean;
  policy?: string | null;
  alreadyExisted: boolean;
}

export const POST = timeRoute(
  "payments.refund",
  async (
    request: NextRequest,
    ctx: { params: Promise<{ tranId: string }> }
  ): Promise<Response> => {
    let bookingCode = "";
    try {
      const { tranId: rawId } = await ctx.params;
      const ref = (rawId ?? "").trim();
      if (!ref || ref.length > 40) return fail("Invalid booking reference", 400);

      const user = await getServerUser(request);
      if (!user) return fail("Unauthorized", 401);

      // S13. A refund is a rare, deliberate act; 10 in five minutes is far
      // beyond any real host workflow and mean for a script. Keyed on the
      // human (user.id), not the profile, so switching profiles does not
      // multiply the budget — the same choice E.3 made.
      //
      // ⚠️ One budget, charged once (S13's own note about the media
      // double-charge). This route does not charge a second time on the
      // SSLCommerz leg, even though that leg is the expensive one.
      const limited = await enforceRateLimit("payments_refund", user.id, request, 10, 300);
      if (limited) return limited;

      const cfg = sslcommerzConfig();
      if (!cfg) return fail("Refunds aren't available right now.", 503);

      const body = await request.json().catch(() => ({}));
      const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

      // ── Resolve the booking through the ACTOR client ─────────────────────
      // RLS (bookings_select_own) scopes this to the buyer or the business, so
      // a stranger's reference is "not found" — absence and denial look
      // identical, the convention D.6 set.
      const db = await createActorClient(request);
      let bookingId = "";

      if (UUID_RE.test(ref) || BOOKING_CODE_RE.test(ref)) {
        // Codes are stored uppercase (generate_booking_code's alphabet is), so
        // a host typing theirs in lowercase still finds it. UUIDs are matched
        // as given — Postgres compares uuid values, not their text.
        const byUuid = UUID_RE.test(ref);
        const { data, error } = await db
          .from("bookings")
          .select("id, code, business_id")
          .eq(byUuid ? "id" : "code", byUuid ? ref : ref.toUpperCase())
          .maybeSingle();
        if (error) return fail(error.message, 500);
        if (!data) return fail("Booking not found", 404);
        if (data.business_id !== user.profileId) {
          // S14, checked HERE and not left to the RPC alone. The RPC checks it
          // too (belt and braces), but a route that forwards an unauthorised
          // call and lets the database sort it out is S2's exact complaint.
          return fail("Only the host can refund a booking.", 403);
        }
        bookingId = data.id;
        bookingCode = data.code;
      } else if (TRAN_ID_RE.test(ref)) {
        const { data, error } = await db
          .from("payment_intents")
          .select("booking_id, business_id")
          .eq("tran_id", ref)
          .maybeSingle();
        if (error) return fail(error.message, 500);
        if (!data) return fail("Payment not found", 404);
        if (data.business_id !== user.profileId) {
          return fail("Only the host can refund a booking.", 403);
        }
        bookingId = data.booking_id;
      } else {
        return fail("Invalid booking reference", 400);
      }

      const admin = createAdminClient();

      // ── Step 1: decide and record, as ONE transaction ────────────────────
      const { data: startedRaw, error: startErr } = await admin.rpc("refund_booking", {
        p_booking_id: bookingId,
        p_reason: reason,
        p_actor_profile_id: user.profileId,
      });

      if (startErr) {
        const { status, message } = mapBookingError((startErr.message ?? "").trim());
        await logPaymentEvent({
          tranId: null,
          eventType: "REFUND_FAILED",
          note: `refund_booking refused for booking ${bookingId}: ${startErr.message}`,
        });
        return fail(message, status);
      }

      const started = startedRaw as unknown as RefundStarted;
      bookingCode = started.bookingCode ?? bookingCode;

      // ── S5: a replay. The refund already exists. ─────────────────────────
      // Do NOT call SSLCommerz again: a second initiateRefund against the same
      // bank_tran_id is a second real money movement, and the gateway has no
      // reason to refuse it. A host double-tapping Refund must not refund
      // twice, which is exactly what payment_refunds_one_active_idx and this
      // branch exist for.
      if (started.alreadyExisted) {
        return ok(
          {
            refundId: started.refundId,
            bookingId: started.bookingId,
            bookingCode: started.bookingCode,
            bookingStatus: started.bookingStatus,
            amountMinor: started.amountMinor,
            currency: started.currency,
            refundStatus: started.refundStatus,
            settled: started.refundStatus === "COMPLETED",
          },
          started.refundStatus === "COMPLETED"
            ? "This booking has already been refunded."
            : "A refund for this booking is already in progress."
        );
      }

      await logPaymentEvent({
        paymentIntentId: null,
        tranId: started.tranId,
        eventType: "REFUND_REQUESTED",
        note: `Booking ${started.bookingCode} · ${started.amountMinor} ${started.currency} minor · policy=${started.policy ?? "(none)"} · hostCancelled=${started.hostCancelled}`,
      });

      // ── Step 2: ask the gateway ──────────────────────────────────────────
      let gateway;
      let auditFields: Record<string, string>;
      try {
        const call = await sslcommerzInitiateRefund(cfg, {
          bankTranId: started.bankTranId,
          amountMinor: Number(started.amountMinor),
          remarks: reason || `Booking ${started.bookingCode}`,
          refeId: started.refeId,
        });
        gateway = call.result;
        auditFields = call.auditFields;
      } catch (e) {
        // Unreachable gateway. Leave the refund INITIATED — we have learned
        // NOTHING about whether the money moved, and marking it FAILED here
        // would assert something we do not know and could strand a guest whose
        // refund actually went through. E.6's sweep picks it up.
        await logPaymentEvent({
          tranId: started.tranId,
          eventType: "REFUND_FAILED",
          note: `Gateway unreachable, refund left INITIATED for the sweep: ${String(e)}`,
        });
        captureRouteError(`refund: gateway unreachable for ${started.refeId}`);
        return fail("Couldn't reach the payment gateway. The refund is queued and will retry.", 502);
      }

      // The audit copy mirrors what actually went on the wire, password masked
      // (S7) — the same reasoning E.3 wrote down: an audit row that omits which
      // store a refund was issued against is missing the one thing you need
      // when reconciling with SSLCommerz.
      await admin
        .from("payment_refunds")
        .update({ request_payload: auditFields as never })
        .eq("id", started.refundId);

      // ── ⚠️ APIConnect FIRST. It is a different question from `status`. ───
      // Not DONE means our call did not complete — bad credentials, a
      // malformed request, the API unwell. We have learned nothing about the
      // money, so the refund stays INITIATED for the sweep rather than being
      // recorded as refused.
      if (!refundApiAnswered(gateway)) {
        await logPaymentEvent({
          tranId: started.tranId,
          eventType: "REFUND_FAILED",
          payload: gateway.raw,
          note: `APIConnect=${gateway.apiConnect || "(none)"} — we learned nothing; refund left INITIATED for the sweep`,
        });
        captureRouteError(`refund: APIConnect=${gateway.apiConnect} for ${started.refeId}`);
        return fail("The payment gateway couldn't be reached. The refund is queued.", 502);
      }

      // ── Settled immediately ──────────────────────────────────────────────
      if (isRefundSettledStatus(gateway.status)) {
        const { data: done, error: completeErr } = await admin.rpc("complete_booking_refund", {
          p_refund_id: started.refundId,
          // The gateway's own handle. payment_refunds_ref_id_chk refuses
          // COMPLETED without one; falling back to our refe_id would satisfy
          // the constraint while recording a value SSLCommerz cannot look up,
          // so if they did not give us one we treat it as unsettled instead.
          p_provider_ref: gateway.refundRefId || "",
          p_response: gateway.raw as never,
        });

        if (completeErr) {
          // ⚠️ The money HAS gone back and our ledger does not know. This is
          // the mirror of E.4's "paid but unbookable" and it needs the same
          // volume: the sweep will retry (the refund is still INITIATED and
          // the gateway will now report it settled), but a human should see it.
          await logPaymentEvent({
            tranId: started.tranId,
            eventType: "REFUND_FAILED",
            payload: gateway.raw,
            note: `⚠️ MONEY REFUNDED AT THE GATEWAY, LEDGER NOT REVERSED (${(completeErr.message ?? "").trim()}) — the sweep will retry`,
          });
          captureRouteError(`refund: gateway settled but ledger failed: ${started.refeId}`, {
            refeId: started.refeId,
          });
          return fail("The refund went through but we couldn't finish recording it. We're on it.", 500);
        }

        await logPaymentEvent({
          tranId: started.tranId,
          eventType: "REFUND_SUCCEEDED",
          payload: { gateway: gateway.raw, result: done },
          note: `Refunded ${started.amountMinor} ${started.currency} minor · ref=${gateway.refundRefId}`,
        });

        return ok(
          {
            refundId: started.refundId,
            bookingId: started.bookingId,
            bookingCode: started.bookingCode,
            bookingStatus: "REFUNDED",
            amountMinor: started.amountMinor,
            currency: started.currency,
            refundStatus: "COMPLETED",
            settled: true,
          },
          "Refund issued"
        );
      }

      // ── Accepted, not settled ────────────────────────────────────────────
      // A real status their API returns. The ledger is deliberately NOT
      // reversed yet: it records what happened, not what was requested, and
      // un-reversing it if the gateway later refuses would be a second money
      // movement invented to correct a first one that should not have existed.
      if (isRefundInFlightStatus(gateway.status)) {
        await admin
          .from("payment_refunds")
          .update({
            status: "PROCESSING",
            provider_refund_ref_id: gateway.refundRefId || null,
            requested_at: new Date().toISOString(),
            response_payload: gateway.raw as never,
          })
          .eq("id", started.refundId)
          .eq("status", "INITIATED");

        await logPaymentEvent({
          tranId: started.tranId,
          eventType: "REFUND_PROCESSING",
          payload: gateway.raw,
          note: `Accepted, not settled · ref=${gateway.refundRefId || "(none)"} — E.6's sweep will resolve it`,
        });

        return ok(
          {
            refundId: started.refundId,
            bookingId: started.bookingId,
            bookingCode: started.bookingCode,
            bookingStatus: started.bookingStatus,
            amountMinor: started.amountMinor,
            currency: started.currency,
            refundStatus: "PROCESSING",
            settled: false,
          },
          "Refund submitted. It usually settles within a few minutes."
        );
      }

      // ── Refused ──────────────────────────────────────────────────────────
      // The gateway answered and said no. Record it as FAILED so the sweep
      // stops looking and the one-active index frees up for a retry.
      //
      // ⚠️ The booking stays CANCELLED, not restored to CONFIRMED. The seat
      // has already gone back to the slot and may have been resold in the
      // meantime; un-cancelling could oversell. The guest is owed money and
      // that is now a manual/dispute matter (I.2) — which is the honest state,
      // and it is why this returns a 502 rather than pretending otherwise.
      await admin
        .from("payment_refunds")
        .update({
          status: "FAILED",
          provider_refund_ref_id: gateway.refundRefId || null,
          requested_at: new Date().toISOString(),
          failed_at: new Date().toISOString(),
          response_payload: gateway.raw as never,
        })
        .eq("id", started.refundId)
        .in("status", ["INITIATED", "PROCESSING"]);

      await logPaymentEvent({
        tranId: started.tranId,
        eventType: "REFUND_FAILED",
        payload: gateway.raw,
        note: `Gateway refused: status=${gateway.status || "(none)"} reason=${gateway.errorReason || "(none)"}`,
      });
      captureRouteError(`refund: gateway refused ${started.refeId}: ${gateway.errorReason}`);

      return fail("The payment gateway wouldn't process this refund. The booking is cancelled.", 502);
    } catch (e) {
      console.error("POST /api/payments/[tranId]/refund error:", e);
      captureRouteError(`refund: unhandled: ${String(e)}`, { bookingCode });
      return fail("Internal server error", 500);
    }
  }
);
