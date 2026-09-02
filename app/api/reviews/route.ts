import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { mapReviewError } from "@/lib/api/review-errors";
import { mapReview } from "@/lib/api/review-mapper";

// bussinesstemplate.md Phase F.4 · POST /api/reviews
//
// body { bookingId, rating, accuracyRating?, valueRating?, hostRating?, body?, media? }
//
// ⚠️ Deliberately NOT accepted from the client, ever: offeringId, businessId,
// authorProfileId, bookingProof, status, editedUntil. Every one of these is
// derived by offering_reviews_derive_from_booking() (the F.1 BEFORE INSERT
// trigger, 20260903110000) from booking_id alone, and the table's own column
// grant only lists (booking_id, rating, accuracy_rating, value_rating,
// host_rating, body, media) for INSERT -- naming anything else would be a
// loud permission error from Postgres, not a value this route has to
// remember to strip. This route strips them anyway, before that error ever
// has a chance to fire, so a client sending a stray field gets a clean 400
// worded for a human instead of a raw grant-denied message.
//
// Almost nothing here is real authorization logic: the RLS insert policy
// (offering_reviews_insert_own_completed_booking) requires the caller to own
// a COMPLETED booking with this id, and the trigger enforces the rest of F.3
// (window, self-review, blocked pair) session-independently. This route's
// job is request-shape validation and turning whatever the DB refuses into a
// sentence (mapReviewError), matching F.3's own "closed at 30 days" vs a
// generic denial (B.4).
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("reviews_create", user.id, request, 10, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
    if (!bookingId) return fail("bookingId is required", 400);

    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fail("rating must be a whole number from 1 to 5", 400);
    }

    const subScore = (v: unknown, field: string): number | null | undefined => {
      if (v === undefined || v === null) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new Error(`${field} must be a whole number from 1 to 5`);
      }
      return n;
    };

    let accuracyRating: number | null;
    let valueRating: number | null;
    let hostRating: number | null;
    try {
      accuracyRating = subScore(body.accuracyRating, "accuracyRating") ?? null;
      valueRating = subScore(body.valueRating, "valueRating") ?? null;
      hostRating = subScore(body.hostRating, "hostRating") ?? null;
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Invalid sub-rating", 400);
    }

    let reviewBody: string | null = null;
    if (body.body !== undefined && body.body !== null) {
      if (typeof body.body !== "string") return fail("body must be text", 400);
      const trimmed = body.body.trim();
      if (trimmed.length > 2000) return fail("Review text is too long (max 2000 characters)", 400);
      reviewBody = trimmed.length > 0 ? trimmed : null;
    }

    let media: string[] = [];
    if (body.media !== undefined && body.media !== null) {
      if (!Array.isArray(body.media) || !body.media.every((m: unknown) => typeof m === "string")) {
        return fail("media must be a list of URLs", 400);
      }
      // Defense in depth -- the DB caps at 6 (offering_reviews_media_chk) too.
      if (body.media.length > 6) return fail("At most 6 media items per review", 400);
      media = body.media;
    }

    const db = await createActorClient(request);
    const { data, error } = await db
      .from("offering_reviews")
      .insert({
        booking_id: bookingId,
        rating,
        accuracy_rating: accuracyRating,
        value_rating: valueRating,
        host_rating: hostRating,
        body: reviewBody,
        media,
      })
      .select("*")
      .single();

    if (error) {
      const { status, message } = mapReviewError(error.message);
      return fail(message, status);
    }

    return ok(mapReview(data), "Review created");
  } catch (e) {
    console.error("POST /api/reviews error:", e);
    return fail("Internal server error", 500);
  }
}
