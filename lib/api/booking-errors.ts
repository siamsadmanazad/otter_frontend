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
};

export function mapBookingError(rawMessage: string): { status: number; message: string } {
  return BOOKING_ERRORS[rawMessage] ?? { status: 400, message: rawMessage };
}
