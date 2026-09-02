// TripOtter · bussinesstemplate.md Phase D.6 · booking error mapping
//
// create_booking()/respond_to_booking()/cancel_booking() (otter_backend)
// raise a specific error code per rejection reason. This is a TABLE mapping
// each one to an HTTP status and a sentence a traveller or host can actually
// read -- the same "table, not a chain of ifs" shape offering-fields.ts
// already uses, for the same reason: the interesting fact about each code is
// one row of data, and a table can be checked against the RPCs' own RAISE
// statements in ten seconds.
//
// Any code NOT in this table (a bug, or a genuinely unexpected Postgres
// error) falls back to 400 with the raw message -- never a silent 500 that
// hides what actually happened.

const BOOKING_ERRORS: Record<string, { status: number; message: string }> = {
  INVALID_REQUEST: { status: 400, message: "That request is missing something required." },
  BUSINESS_CANNOT_BOOK: { status: 403, message: "A business profile can't book a service." },
  SLOT_NOT_FOUND: { status: 404, message: "That date is no longer available." },
  SLOT_OFFERING_MISMATCH: { status: 400, message: "That date doesn't belong to this service." },
  SLOT_CLOSED: { status: 409, message: "That date is no longer available." },
  SLOT_IN_PAST: { status: 409, message: "That date has already passed." },
  OFFERING_NOT_FOUND: { status: 404, message: "That service no longer exists." },
  OFFERING_NOT_ACTIVE: { status: 409, message: "This service isn't currently bookable." },
  OFFERING_NOT_RESERVABLE: {
    status: 409,
    message: "This service can't be reserved directly -- message the host instead.",
  },
  PRICE_ON_REQUEST_CANNOT_BOOK: {
    status: 409,
    message: "This service's price is set by enquiry -- message the host instead.",
  },
  CANNOT_BOOK_OWN_SERVICE: { status: 403, message: "You can't book your own service." },
  INVALID_PARTY_SIZE: { status: 400, message: "That party size isn't valid." },
  PARTY_TOO_SMALL: { status: 400, message: "That party is smaller than this service allows." },
  PARTY_TOO_LARGE: { status: 400, message: "That party is larger than this service allows." },
  LEAD_TIME_NOT_MET: { status: 409, message: "This needs to be booked further ahead of time." },
  BOOKING_CUTOFF_PASSED: { status: 409, message: "It's too close to the date to book this now." },
  NOT_ENOUGH_CAPACITY: { status: 409, message: "Not enough seats left for that party size." },
  BOOKING_NOT_FOUND: { status: 404, message: "That booking doesn't exist." },
  FORBIDDEN: { status: 403, message: "You don't have permission to do that." },
  ALREADY_DECIDED: { status: 409, message: "This request has already been responded to." },
  NOT_CANCELLABLE: { status: 409, message: "This booking can no longer be cancelled." },

  // ── E.7 refunds (refund_booking / complete_booking_refund) ────────────────
  // Every one of these is a sentence a HOST reads, not a guest -- E.7 is
  // host-only (S14) -- so they say what the host can do about it rather than
  // apologising. None of them name an amount the host did not already see.
  REFUND_INVALID_REQUEST: { status: 400, message: "That refund request is missing something." },
  REFUND_NOTHING_TO_REFUND: {
    status: 409,
    message: "No payment was ever collected for this booking, so there's nothing to refund.",
  },
  REFUND_NO_BANK_TRAN_ID: {
    status: 409,
    message: "This payment has no bank reference yet, so it can't be refunded automatically.",
  },
  REFUND_NOT_REFUNDABLE: {
    status: 409,
    message: "This booking's cancellation policy doesn't return anything at this point.",
  },
  REFUND_BOOKING_NOT_REFUNDABLE: {
    status: 409,
    message: "This booking isn't in a state that can be refunded.",
  },
  REFUND_BOOKING_COMPLETED: {
    status: 409,
    message: "This booking has already been completed. Refunding it now needs a dispute.",
  },
  REFUND_ALREADY_REFUNDED: { status: 409, message: "This booking has already been refunded." },
  REFUND_EXCEEDS_PAYMENT: { status: 409, message: "A refund can't be more than what was paid." },
  REFUND_BOOKING_STATE_CHANGED: {
    status: 409,
    message: "This booking changed while the refund was running. Reload and try again.",
  },
  REFUND_NOT_FOUND: { status: 404, message: "That refund doesn't exist." },
  REFUND_ALREADY_FAILED: { status: 409, message: "This refund already failed." },
  REFUND_TERMS_MISSING: {
    status: 500,
    message: "This booking's cancellation policy has no refund terms configured.",
  },
};

export function mapBookingError(rawMessage: string): { status: number; message: string } {
  return BOOKING_ERRORS[rawMessage] ?? { status: 400, message: rawMessage };
}
