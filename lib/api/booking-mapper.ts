// bussinesstemplate.md Phase D.6 -- shared across every /api/bookings route
// so the shape a client sees is defined exactly once.
//
// Deliberately excludes cancelled_by (an internal id neither side needs --
// they already know who cancelled, they did it or the other party did) and
// includes guest contact only because RLS already scopes every row a route
// can return to the buyer or the business themselves (§8 S11's PII rule
// holds by construction here, not by this mapper remembering to omit a
// field for some OTHER caller who should never have reached it).
export function mapBooking(b: Record<string, unknown>) {
  return {
    id: b.id,
    code: b.code,
    offeringId: b.offering_id,
    slotId: b.slot_id,
    buyerProfileId: b.buyer_profile_id,
    businessId: b.business_id,
    partySize: b.party_size,
    amountMinor: b.amount_minor,
    currency: b.currency,
    status: b.status,
    cancellationPolicy: b.cancellation_policy,
    offeringTitle: b.offering_title,
    offeringType: b.offering_type,
    slotStartsAt: b.slot_starts_at,
    slotEndsAt: b.slot_ends_at,
    guestName: b.guest_name,
    guestPhone: b.guest_phone,
    guestEmail: b.guest_email,
    guestNote: b.guest_note,
    hostResponseNote: b.host_response_note,
    cancelReason: b.cancel_reason,
    requestedAt: b.requested_at,
    confirmedAt: b.confirmed_at,
    cancelledAt: b.cancelled_at,
    completedAt: b.completed_at,
    expiresAt: b.expires_at,
    createdAt: b.created_at,
  };
}
