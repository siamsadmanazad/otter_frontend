// TripOtter · bussinesstemplate.md Phase F.4 · review error mapping
//
// offering_reviews_derive_from_booking() (BEFORE INSERT) and
// offering_reviews_guard_update() (BEFORE UPDATE) -- both in the F.1
// migration, 20260903110000_offering_reviews.sql -- raise a specific named
// error per rejection reason. This is a TABLE mapping each one to an HTTP
// status and a sentence a guest or host can actually read, the same
// "table, not a chain of ifs" shape booking-errors.ts already uses -- these
// are a distinct domain (reviews, not bookings) with their own vocabulary, so
// they get their own file rather than growing booking-errors.ts, matching how
// payment_events/booking errors got their own file too.
//
// Any code NOT in this table (a bug, or a genuinely unexpected Postgres
// error) falls back to 400 with the raw message -- never a silent 500 that
// hides what actually happened.

const REVIEW_ERRORS: Record<string, { status: number; message: string }> = {
  // ── offering_reviews_derive_from_booking() (F.3, BEFORE INSERT) ──────────
  REVIEW_BOOKING_NOT_FOUND: { status: 404, message: "That booking doesn't exist." },
  REVIEW_BOOKING_NOT_COMPLETED: {
    status: 409,
    message: "You can only review a booking after it's completed.",
  },
  REVIEW_WINDOW_NOT_OPEN: {
    status: 409,
    message: "Reviews open 24 hours after your booking is completed -- check back soon.",
  },
  REVIEW_WINDOW_CLOSED: {
    status: 409,
    message: "The review window for this booking has closed.",
  },
  REVIEW_SELF_NOT_ALLOWED: {
    status: 403,
    message: "You can't review your own service.",
  },
  REVIEW_BLOCKED: {
    status: 403,
    message: "You can't review this service.",
  },

  // ── offering_reviews_guard_update() (D18, BEFORE UPDATE) ──────────────────
  REVIEW_CORE_IMMUTABLE: {
    status: 409,
    message: "This review's identity can't be changed.",
  },
  REVIEW_EDIT_WINDOW_CLOSED: {
    status: 409,
    message: "This review can no longer be edited -- the 48-hour window has closed.",
  },
  REVIEW_NOT_AUTHOR: {
    status: 403,
    message: "Only the person who wrote this review can edit it.",
  },
  REVIEW_HOST_REPLY_ALREADY_SENT: {
    status: 409,
    message: "This review already has a host reply -- a host may only reply once.",
  },
  REVIEW_HOST_REPLY_IMMUTABLE: {
    status: 409,
    message: "A host reply can't be changed once it's sent.",
  },
  REVIEW_NOT_HOST: {
    status: 403,
    message: "Only the host of this service can reply to a review.",
  },

  // ── toggle_review_helpful() (Phase G.4, 20260903190000) ──────────────────
  REVIEW_NOT_FOUND: {
    status: 404,
    message: "Review not found.",
  },
  REVIEW_NOT_HELPFUL_ELIGIBLE: {
    status: 409,
    message: "This review isn't available to vote on.",
  },
  REVIEW_SELF_HELPFUL_NOT_ALLOWED: {
    status: 403,
    message: "You can't mark your own review as helpful.",
  },

  // ── Postgres constraint fallbacks a caller could realistically hit ────────
  // The one-review-per-booking rule (G3) is a `unique` constraint, not a
  // named RAISE -- PostgREST surfaces it as code 23505 with the constraint
  // name in the message, so this key is matched separately in
  // mapReviewError() below rather than by an exact code.
};

/** offering_reviews_booking_id_key -- G3's "one review per booking, ever." */
const DUPLICATE_REVIEW = {
  status: 409,
  message: "You've already reviewed this booking.",
};

export function mapReviewError(rawMessage: string): { status: number; message: string } {
  const mapped = REVIEW_ERRORS[rawMessage];
  if (mapped) return mapped;
  if (/offering_reviews_booking_id_key|duplicate key value/i.test(rawMessage)) {
    return DUPLICATE_REVIEW;
  }
  return { status: 400, message: rawMessage };
}
