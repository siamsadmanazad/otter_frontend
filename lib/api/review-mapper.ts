// bussinesstemplate.md Phase F.4 -- shared across every /api/reviews and
// /api/offerings/[id]/reviews route so the shape a client sees is defined
// exactly once, mirroring booking-mapper.ts's convention.
//
// `bookingProof` is included, RAW: 'PAID' | 'FREE'. This is the derived
// fact, not the D9 display decision -- a client renders "Free booking" off
// this the same way it would off any other enum, and F.5's floor logic
// (never show a fabricated average below 3 reviews) is a SEPARATE thing this
// mapper has nothing to do with -- it lives in the rating summary the GET
// route builds alongside the list, not on any individual review.
export function mapReview(r: Record<string, unknown>) {
  return {
    id: r.id,
    bookingId: r.booking_id,
    offeringId: r.offering_id,
    businessId: r.business_id,
    authorProfileId: r.author_profile_id,
    rating: r.rating,
    accuracyRating: r.accuracy_rating,
    valueRating: r.value_rating,
    hostRating: r.host_rating,
    body: r.body,
    media: r.media ?? [],
    status: r.status,
    bookingProof: r.booking_proof,
    hostReply: r.host_reply,
    hostRepliedAt: r.host_replied_at,
    editedUntil: r.edited_until,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    // Phase G.4 -- the raw denorm (offering_reviews.helpful_count), same
    // status as bookingProof above. Absent on a row that predates the
    // column's default (there are none -- every existing row backfilled to
    // 0) is impossible here, so this is never optional the way isHelpful is.
    helpfulCount: r.helpful_count ?? 0,
  };
}
