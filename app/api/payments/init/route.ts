import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { logPaymentEvent } from "@/lib/payments/audit";
import {
  buildTranId,
  minorToDecimalString,
  redactForAudit,
  sslcommerzConfig,
  sslcommerzInit,
} from "@/lib/payments/sslcommerz";

// bussinesstemplate.md Phase E.3 · POST /api/payments/init
//
// body { bookingId }   — and nothing else, ever.
//
// ── S3/D13: THE BODY CARRIES NO MONEY ───────────────────────────────────────
// There is no amount field, no currency field, no fee field. The amount comes
// from bookings.amount_minor, which create_booking() computed from a locked
// slot row, and payment_intents' own BEFORE INSERT trigger refuses an intent
// whose amount disagrees with it. Three independent layers, none of which can
// be reached by anything a client types.
//
// ── S7: WHAT COMES BACK ─────────────────────────────────────────────────────
// { gatewayPageUrl }. Not the session key, not the gateway list, not
// SSLCommerz's own response object — one URL, because that is the only thing
// the client needs and every additional field is a decision to trust the
// client with something. The store credentials obviously never appear; the
// less obvious rule is that `failedreason` doesn't either, since on the
// failure path it can describe our merchant account's state to a stranger.
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // S13. Ten checkout sessions in five minutes is generous for a human
    // double-tapping through a flaky connection and mean for a script opening
    // gateway sessions in a loop. Keyed on user.id (the human) not profileId,
    // so switching profiles does not multiply the budget.
    const limited = await enforceRateLimit("payments_init", user.id, request, 10, 300);
    if (limited) return limited;

    const cfg = sslcommerzConfig();
    if (!cfg) {
      return fail("Payments aren't available right now.", 503);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);
    const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) return fail("bookingId is required", 400);

    // ── The booking, read through the ACTOR client ─────────────────────────
    // RLS scopes this to the buyer or the business. That is visibility, not
    // authority: a host can SEE a booking they must not be able to pay for
    // (paying on the guest's behalf would let a host confirm their own
    // inventory and manufacture the attendance record Phase F's reviews rest
    // on). So the buyer check below is explicit and separate — S2's "every
    // new route must thread the acting profile explicitly", exactly.
    const db = await createActorClient(request);
    const { data: booking, error: bookingErr } = await db
      .from("bookings")
      .select(
        "id, code, status, amount_minor, currency, buyer_profile_id, business_id, offering_title, guest_name, guest_phone, guest_email"
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingErr) return fail(bookingErr.message, 500);
    if (!booking) return fail("Booking not found", 404);

    if (booking.buyer_profile_id !== user.profileId) {
      return fail("Only the guest who booked can pay for it.", 403);
    }
    if (booking.status !== "PENDING_PAYMENT") {
      return fail("This booking isn't awaiting payment.", 409);
    }
    const amountMinor = Number(booking.amount_minor);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      return fail("This booking has nothing to pay.", 409);
    }
    // D10: BDT only at launch. A non-BDT service is ENQUIRE-only until a
    // second PSP exists (E.0), and sending another currency to a BDT-only
    // merchant account produces a gateway error the guest cannot act on.
    if (String(booking.currency).toUpperCase() !== "BDT") {
      return fail("This service can't be paid for online yet.", 409);
    }

    const admin = createAdminClient();

    // ── Idempotency: the double-tapped "Pay now" ───────────────────────────
    // payment_intents_one_live_idx allows exactly ONE intent per booking in
    // INITIATED/PENDING, so a second insert here raises a unique violation.
    // That index is right — two live gateway sessions means a determined
    // guest can pay both — but it means this route must RESOLVE the existing
    // session rather than trip over it.
    //
    // The resolution is to return the session we already have. A guest who
    // taps twice is asking to reach the gateway, not asking for a second
    // charge, and handing back the same GatewayPageURL is the answer to what
    // they actually asked. Expiring the old intent and opening a new one
    // would be the *worse* choice with the same code shape: it leaves the
    // first gateway page live in whatever tab or WebView already loaded it,
    // which is precisely the two-payable-sessions problem the index exists to
    // prevent.
    const { data: live } = await admin
      .from("payment_intents")
      .select("id, tran_id, status, response_payload")
      .eq("booking_id", booking.id)
      .in("status", ["INITIATED", "PENDING"])
      .maybeSingle();

    if (live) {
      const stored = (live.response_payload ?? {}) as Record<string, unknown>;
      const url = typeof stored.GatewayPageURL === "string" ? stored.GatewayPageURL : "";
      if (live.status === "PENDING" && url) {
        return ok({ gatewayPageUrl: url }, "Payment session resumed");
      }
      // An INITIATED intent with no gateway URL is a session that never
      // actually reached SSLCommerz — the init call failed, or the process
      // died between the insert and the response. It holds the one-live slot
      // and nothing can use it, so close it and open a fresh one below.
      // (Only status/closed_at move; the freeze trigger guards the rest.)
      await admin
        .from("payment_intents")
        .update({ status: "FAILED", closed_at: new Date().toISOString() })
        .eq("id", live.id)
        .in("status", ["INITIATED", "PENDING"]);
      await logPaymentEvent({
        paymentIntentId: live.id,
        tranId: live.tran_id,
        eventType: "INIT_FAILED",
        note: "Superseded: prior intent had no gateway page (init never completed)",
      });
    }

    // ── The new intent ─────────────────────────────────────────────────────
    // Inserted BEFORE the gateway is called, deliberately. If the order were
    // reversed, a crash between a successful init and our insert would leave
    // a live gateway session with no record on our side — a guest able to pay
    // for a transaction id we would not recognise on the way back, which is
    // R-6 manufactured by our own ordering. Inserting first means the worst
    // case is an INITIATED row that never reaches the gateway, which the
    // block above cleans up and E.6 expires.
    const tranId = buildTranId(String(booking.code));
    const { data: intent, error: intentErr } = await admin
      .from("payment_intents")
      .insert({
        booking_id: booking.id,
        // The BEFORE INSERT trigger OVERWRITES buyer/business/currency from
        // the booking and REFUSES an amount that disagrees with it. They are
        // sent anyway because the columns are NOT NULL and because sending
        // the values we believe is what lets the trigger disagree — a route
        // that sent placeholders would be handing the database a question it
        // could only answer, never check.
        buyer_profile_id: booking.buyer_profile_id,
        business_id: booking.business_id,
        provider: "sslcommerz",
        tran_id: tranId,
        amount_minor: amountMinor,
        currency: "BDT",
        status: "INITIATED",
        idempotency_key: tranId,
      })
      .select("id, tran_id")
      .single();

    if (intentErr || !intent) {
      const msg = intentErr?.message ?? "intent insert returned no row";
      await logPaymentEvent({
        tranId,
        eventType: "INIT_FAILED",
        note: `Intent insert failed: ${msg}`,
      });
      if (msg.includes("INTENT_BOOKING_NOT_PAYABLE")) {
        return fail("This booking isn't awaiting payment.", 409);
      }
      if (msg.includes("INTENT_AMOUNT_MISMATCH")) {
        return fail("This booking's amount has changed. Reload and try again.", 409);
      }
      if (msg.includes("payment_intents_one_live_idx")) {
        // Lost a race with a concurrent tap of the same button. Not an error
        // worth showing: the other request is opening the session.
        return fail("A payment is already being set up for this booking.", 409);
      }
      return fail("Couldn't start this payment. Try again.", 500);
    }

    // ── The gateway call ───────────────────────────────────────────────────
    const returnBase = `${cfg.appUrl}/api/payments/return`;
    const fields: Record<string, string> = {
      total_amount: minorToDecimalString(amountMinor),
      currency: "BDT",
      tran_id: tranId,
      success_url: `${returnBase}/success?tran_id=${encodeURIComponent(tranId)}`,
      fail_url: `${returnBase}/fail?tran_id=${encodeURIComponent(tranId)}`,
      cancel_url: `${returnBase}/cancel?tran_id=${encodeURIComponent(tranId)}`,
      ipn_url: `${cfg.appUrl}${cfg.ipnPath}`,

      // ⚠️ "general", NOT "travel-vertical" — and this is a case where the
      // published docs and the live API disagree, so the reason is recorded
      // rather than left to be rediscovered.
      //
      // "travel-vertical" reads like the obviously correct choice for a
      // travel marketplace. It is not: SSLCommerz's travel profile is
      // specifically a HOTEL profile, and declaring it makes four further
      // fields mandatory. Verified against the live sandbox, one at a time —
      // the init is refused with, in order:
      //     "Invalid Information! 'hotel_name' is missing."
      //     "Invalid Information! 'length_of_stay' is missing. Example: 2 days"
      // (and room_type/hotel_city behind those).
      //
      // TripOtter sells eight offering types and exactly one of them (STAY)
      // is hotel-shaped. Choosing travel-vertical would mean inventing a
      // hotel_name and a length_of_stay for a dive tour, an airport transfer
      // and a cooking class — false metadata submitted to a payment
      // processor, which is precisely the paperwork that loses a chargeback
      // dispute rather than winning one. `product_category: "travel"` still
      // carries the honest classification.
      //
      // Revisit only if STAY bookings are ever split onto their own init
      // path, where the four hotel fields would be real answers.
      product_profile: "general",
      product_category: "travel",
      product_name: String(booking.offering_title ?? "TripOtter booking").slice(0, 100),
      // A service, not a parcel. Without this SSLCommerz expects a shipping
      // address block and rejects the init.
      shipping_method: "NO",

      // The guest's own contact, with fallbacks — SSLCommerz requires all
      // four cus_* fields to be non-empty and rejects the init otherwise.
      // Fallbacks are deliberately generic placeholders, never another
      // person's data pulled from the profile row.
      cus_name: String(booking.guest_name ?? "").trim() || "TripOtter guest",
      cus_email: String(booking.guest_email ?? "").trim() || "bookings@tripotter.app",
      cus_phone: String(booking.guest_phone ?? "").trim() || "01700000000",
      cus_add1: "N/A",
      cus_city: "Dhaka",
      cus_country: "Bangladesh",

      // Echoed back untouched in the IPN. A cheap cross-check, and NEVER an
      // authority — value_a is as attacker-controllable as every other field
      // in a POST body, so E.4 logs a mismatch as a signal and still decides
      // on the validator API alone.
      value_a: String(intent.id),
      value_b: String(booking.id),
      value_c: String(booking.code),
    };

    // The audit copy mirrors what was ACTUALLY sent on the wire, credentials
    // included, with only the password masked (S7). sslcommerzInit() adds
    // store_id/store_passwd itself, so `fields` alone would understate the
    // request — and an audit row that omits which store a payment was opened
    // against is missing the one thing you need when reconciling two stores
    // or explaining a rejection to SSLCommerz.
    const auditFields = redactForAudit({
      store_id: cfg.storeId,
      store_passwd: cfg.storePasswd,
      ...fields,
    });

    await logPaymentEvent({
      paymentIntentId: intent.id,
      tranId,
      eventType: "INIT_REQUESTED",
      payload: auditFields,
      note: `Booking ${booking.code} · ${amountMinor} BDT minor`,
    });

    let result;
    try {
      result = await sslcommerzInit(cfg, fields);
    } catch (e) {
      // The gateway was unreachable or timed out. The intent stays INITIATED
      // (not FAILED): the request may still have landed, and E.6's
      // tran_id query is what settles that — marking it FAILED here would
      // assert something we do not know.
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId,
        eventType: "INIT_FAILED",
        note: `Gateway unreachable: ${String(e)}`,
      });
      return fail("Couldn't reach the payment gateway. Try again in a moment.", 502);
    }

    if (!result.ok || !result.gatewayPageUrl) {
      await admin
        .from("payment_intents")
        .update({
          status: "FAILED",
          closed_at: new Date().toISOString(),
          request_payload: auditFields as never,
          response_payload: result.raw as never,
        })
        .eq("id", intent.id);
      await logPaymentEvent({
        paymentIntentId: intent.id,
        tranId,
        eventType: "INIT_FAILED",
        payload: result.raw,
        note: result.reason,
      });
      // result.reason stays in the audit row and out of the response (S7).
      return fail("The payment gateway couldn't start this payment.", 502);
    }

    await admin
      .from("payment_intents")
      .update({
        status: "PENDING",
        gateway_at: new Date().toISOString(),
        request_payload: auditFields as never,
        response_payload: result.raw as never,
      })
      .eq("id", intent.id);

    await logPaymentEvent({
      paymentIntentId: intent.id,
      tranId,
      eventType: "INIT_SUCCEEDED",
      payload: result.raw,
    });

    return ok({ gatewayPageUrl: result.gatewayPageUrl }, "Payment session created");
  } catch (e) {
    console.error("POST /api/payments/init error:", e);
    return fail("Internal server error", 500);
  }
}
