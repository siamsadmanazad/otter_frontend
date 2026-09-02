// TripOtter · bussinesstemplate.md Phase E · payment_events, from the routes
//
// S5: "every delivery appended to payment_events". Every one of E.3-E.6's
// routes writes here, so the write is defined once — including the two
// properties that are easy to lose when four routes each roll their own:
//
//   1. It NEVER throws. An audit write that can fail the operation it is
//      auditing turns a working payment into a 500, and SSLCommerz then
//      retries a payment that actually succeeded. Logging is a side effect of
//      the money moving, never a precondition for it.
//   2. It is always service-role. payment_events has RLS on and NO policy for
//      any client (E.1 revoked the grants outright), so an actor client
//      writing here is not a permission bug waiting to happen — it simply
//      cannot work.

import { createAdminClient } from "@/lib/supabase/admin";
import { captureRouteError } from "@/lib/observability";

/**
 * The closed vocabulary from 20260903000000_payment_intents.sql's
 * payment_events_type_chk. Stated as a union type rather than `string` so a
 * typo is a compile error here instead of a constraint violation in
 * production — the check constraint is the guarantee, this is the early
 * warning.
 */
export type PaymentEventType =
  | "INIT_REQUESTED"
  | "INIT_SUCCEEDED"
  | "INIT_FAILED"
  | "IPN_RECEIVED"
  | "IPN_VALIDATED"
  | "IPN_REJECTED"
  | "RETURN_SUCCESS"
  | "RETURN_FAIL"
  | "RETURN_CANCEL"
  | "RECONCILE_REQUESTED"
  | "RECONCILED"
  | "RECONCILE_EXPIRED"
  | "REFUND_REQUESTED"
  | "REFUND_PROCESSING"
  | "REFUND_SUCCEEDED"
  | "REFUND_FAILED"
  | "PAYOUT_RECORDED";

export interface PaymentEventInput {
  /** Null for an orphan delivery — a tran_id we never issued (E.1's own design). */
  paymentIntentId?: string | null;
  /** As delivered/sent, unvalidated. */
  tranId?: string | null;
  eventType: PaymentEventType;
  payload?: unknown;
  /** Why, in words. "amount 50000 != intent 500000". */
  note?: string | null;
}

export async function logPaymentEvent(input: PaymentEventInput): Promise<void> {
  try {
    const db = createAdminClient();
    const { error } = await db.from("payment_events").insert({
      payment_intent_id: input.paymentIntentId ?? null,
      tran_id: input.tranId ?? null,
      event_type: input.eventType,
      payload: (input.payload ?? null) as never,
      note: input.note ?? null,
    });
    if (error) {
      // Reported, not thrown. A payment whose audit row failed to write is
      // still a payment; a silently missing audit row is what we must never
      // have, so it surfaces in observability instead.
      captureRouteError(`payment_events insert failed: ${error.message}`, {
        eventType: input.eventType,
      });
    }
  } catch (e) {
    captureRouteError(`payment_events insert threw: ${String(e)}`, {
      eventType: input.eventType,
    });
  }
}
