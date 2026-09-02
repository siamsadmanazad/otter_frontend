import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// bussinesstemplate.md Phase E.5 · GET /api/payments/[tranId]/status
//
// The endpoint E.5's return pages and E.9's "confirming your payment…" state
// poll. This is the ONLY thing a client may believe about whether a payment
// landed — the redirect it arrived on is a UX hint (D14), this reads what the
// validated IPN actually wrote.
//
// ── AUTHORISATION ───────────────────────────────────────────────────────────
// Read through the ACTOR client, so payment_intents_select_own does the work:
// the buyer, or whoever is acting as the business. A stranger with a stolen
// tran_id gets the same "not found" a nonexistent one gets, which is the
// convention GET /api/bookings/[id] already set — absence and denial look
// identical to a prober.
//
// ⚠️ The select names its columns and MUST keep doing so. E.1 revoked the
// table grant from `authenticated` and granted back a column list that
// excludes request_payload/response_payload (payer-side PII, S11), so
// `select("*")` here would not leak — it would 401 outright. Naming the
// columns is what keeps that a design property rather than a lucky accident.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tranId: string }> }
): Promise<Response> {
  try {
    const { tranId } = await params;
    const id = (tranId ?? "").trim();
    // The database's own tran_id shape. Rejecting here means a malformed id
    // never becomes a query.
    if (!id || id.length > 30 || !/^[A-Za-z0-9_-]+$/.test(id)) {
      return fail("Payment not found", 404);
    }

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const db = await createActorClient(request);
    const { data: intent, error } = await db
      .from("payment_intents")
      .select(
        "id, booking_id, tran_id, status, amount_minor, currency, gateway_at, validated_at, closed_at, created_at"
      )
      .eq("tran_id", id)
      .maybeSingle();

    if (error) return fail(error.message, 500);
    if (!intent) return fail("Payment not found", 404);

    // The booking's own state, from the same RLS-scoped client. A client
    // polling this needs both: the intent says whether the money landed, the
    // booking says whether the seat is theirs, and until E.4's transaction
    // commits they are briefly different answers.
    const { data: booking } = await db
      .from("bookings")
      .select("id, code, status, amount_minor, currency, confirmed_at")
      .eq("id", intent.booking_id)
      .maybeSingle();

    // E.10: the take-rate, so a breakdown can show it without a second
    // round trip. The RATE is public (a settings row readable by anyone);
    // what THIS booking was charged lives on its ledger row, behind the
    // ledger's own RLS, and is deliberately not surfaced here — a guest's
    // breakdown needs the total they pay, not the host's cut.
    const { data: feeSettings } = await db
      .from("platform_fee_settings")
      .select("fee_bps")
      .maybeSingle();

    return ok(
      {
        tranId: intent.tran_id,
        status: intent.status,
        amountMinor: intent.amount_minor,
        currency: intent.currency,
        gatewayAt: intent.gateway_at,
        validatedAt: intent.validated_at,
        closedAt: intent.closed_at,
        createdAt: intent.created_at,
        booking: booking
          ? {
              id: booking.id,
              code: booking.code,
              status: booking.status,
              amountMinor: booking.amount_minor,
              currency: booking.currency,
              confirmedAt: booking.confirmed_at,
            }
          : null,
        platformFeeBps: feeSettings?.fee_bps ?? 0,
      },
      "Payment status retrieved"
    );
  } catch (e) {
    console.error("GET /api/payments/[tranId]/status error:", e);
    return fail("Internal server error", 500);
  }
}
