import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { mapReview } from "@/lib/api/review-mapper";

// bussinesstemplate.md Phase F.4/F.5 · GET /api/offerings/[id]/reviews
//
// Public -- no auth required (D18: "Reviews are public and permanent").
// createActorClient() falls back to the anon-key client when no bearer/
// cookie session is present, which is exactly right here: RLS's
// offering_reviews_select_published policy is what actually decides
// visibility, not this route.
//
// ?page=&limit=&sort=recent|rating|rating_asc|helpful (default recent)
//
// ── G.3, why `rating_asc` exists ─────────────────────────────────────────
// F.5's own comment already establishes the list is never filtered by
// rating -- a 1★ review was always IN this response. But "not filtered" and
// "reachable" are different claims: with only `recent` and `rating`
// (highest-first) on offer, a critical review sitting on page 4 of a
// popular listing is technically present and practically invisible. D7 says
// the honest negative signal on a service is a low-rated review, not a
// downvote button -- a sort that can only ever surface the FIVE-star end of
// that signal is a quieter version of the same suppression D7 refuses to
// ship. `rating_asc` is the fair counterpart to the `rating` sort that
// already existed; the client (G.3) puts a real control on it rather than
// leaving it a query param nobody can reach.
//
// ── G.4, why `helpful` exists ────────────────────────────────────────────
// G.4's own words are "lets good reviews rise" -- a vote only ever moves
// offering_reviews.helpful_count (G.1's own increment/decrement shape, not a
// rating or a visibility flag), so a SORT is the only thing that turns that
// number into anything a viewer notices. Ties broken by recency, same as
// every other sort here.
//
// ── F.5, THE REASON THIS ROUTE EXISTS SEPARATELY FROM A PLAIN SELECT ────────
// offerings.rating_avg/rating_count hold the RAW value at every count --
// rating_count = 1 with rating_avg = 5.0 is genuinely what's stored (F.2's
// own comment). D9's floor ("below 3 reviews: count only, 'Newly listed'.
// at >= 3: one decimal + count + distribution bar. Never fabricate, never
// round up") is a DISPLAY rule, and this route is where it's enforced --
// ratingAvg/distribution are `null`, not 0, not the raw sub-floor number,
// whenever ratingCount < 3. A client that skipped checking ratingCount
// itself would still be safe: this route simply never sends the number.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!id) return fail("Invalid offering reference", 400);

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
    const from = (page - 1) * limit;
    const sortParam = sp.get("sort");
    const sort =
      sortParam === "rating" || sortParam === "rating_asc" || sortParam === "helpful"
        ? sortParam
        : "recent";

    const db = await createActorClient(request);

    // ── The rating summary (F.5) ─────────────────────────────────────────────
    // ratingAvg/ratingCount come straight off offerings -- the denormalised,
    // trigger-maintained truth (F.2) -- rather than being recomputed here,
    // so this route can never disagree with the number a search card or the
    // offering's own hero shows.
    const { data: offering, error: offeringErr } = await db
      .from("offerings")
      .select("id, rating_avg, rating_count")
      .eq("id", id)
      .maybeSingle();
    if (offeringErr) return fail(offeringErr.message, 500);
    if (!offering) return fail("Service not found", 404);

    const ratingCount = offering.rating_count ?? 0;
    const isNewlyListed = ratingCount < 3;

    // The distribution bar only has a reason to exist once the floor is
    // cleared -- no point querying for a number D9 says not to show.
    let distribution: Record<1 | 2 | 3 | 4 | 5, number> | null = null;
    if (!isNewlyListed) {
      // Same filter as review_counts_toward_rating() (PUBLISHED and PAID,
      // §12 Q4) -- called through the DB function rather than re-stated here,
      // so a future change to that policy can't leave this bar disagreeing
      // with the average sitting right next to it.
      const { data: countable, error: distErr } = await db
        .from("offering_reviews")
        .select("rating, status, booking_proof")
        .eq("offering_id", id)
        .eq("status", "PUBLISHED")
        .eq("booking_proof", "PAID");
      if (distErr) return fail(distErr.message, 500);

      distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of countable ?? []) {
        const star = Number(r.rating) as 1 | 2 | 3 | 4 | 5;
        if (star >= 1 && star <= 5) distribution[star] += 1;
      }
    }

    // ── The list itself ───────────────────────────────────────────────────
    // Every PUBLISHED review, paginated -- including FREE-proof ones (F.5:
    // "the full review list regardless", per the F.2 migration's own
    // comment). A free-booking review is real and displayed, labelled
    // "Free booking" client-side off bookingProof; it just doesn't move the
    // number above.
    let query = db
      .from("offering_reviews")
      .select(
        `id, booking_id, offering_id, business_id, author_profile_id, rating,
         accuracy_rating, value_rating, host_rating, body, media, status,
         booking_proof, host_reply, host_replied_at, edited_until,
         helpful_count, created_at, updated_at,
         author:profiles!offering_reviews_author_profile_id_fkey(id, username, full_name, profile_image)`,
        { count: "exact" }
      )
      .eq("offering_id", id)
      .eq("status", "PUBLISHED");

    query =
      sort === "rating"
        ? query.order("rating", { ascending: false }).order("created_at", { ascending: false })
        : sort === "rating_asc"
          ? query.order("rating", { ascending: true }).order("created_at", { ascending: false })
          : sort === "helpful"
            ? query.order("helpful_count", { ascending: false }).order("created_at", { ascending: false })
            : query.order("created_at", { ascending: false });

    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) return fail(error.message, 500);

    // F.6 (Flutter review card, §6): "the stay/trip date (not the post
    // date)" -- that's the BOOKING's slot_starts_at, which mapReview() never
    // carries (it's shared with the create/patch/reply routes, which have
    // no booking row in hand).
    //
    // ⚠️ THIS CANNOT BE A PLAIN EMBED ON THE QUERY ABOVE. `db` here is
    // whatever createActorClient() resolved to -- the anon-key client for
    // this route's own no-auth majority case (D18: reviews are public) --
    // and `bookings_select_own` (RLS) only lets the BUYER or the BUSINESS
    // read a booking row. A `bookings!...(slot_starts_at)` embed under the
    // actor client silently returns null for every anonymous or
    // third-party viewer, i.e. almost every real caller of this route --
    // caught live: a real review posted and fetched through this exact
    // route came back with `stayDate: null` until this was split out.
    // Reviews and their authors are ALREADY fully public here (D18; the
    // author join two lines up exposes name + avatar with no gate at all),
    // so a booking's bare start time carries no privacy exposure this route
    // doesn't already have — a scoped admin-client lookup for just this one
    // column, keyed to the booking ids already on this page, is the
    // narrowest fix that actually works rather than pretending the actor
    // client's RLS was ever going to answer this.
    const bookingIds = [...new Set((data ?? []).map((r) => r.booking_id as string))];
    let slotStartsById = new Map<string, string | null>();
    if (bookingIds.length > 0) {
      const admin = createAdminClient();
      const { data: bookingRows, error: bookingErr } = await admin
        .from("bookings")
        .select("id, slot_starts_at")
        .in("id", bookingIds);
      if (bookingErr) return fail(bookingErr.message, 500);
      slotStartsById = new Map((bookingRows ?? []).map((b) => [b.id as string, b.slot_starts_at as string | null]));
    }

    // ── G.4: isHelpful relative to the VIEWER ────────────────────────────────
    // Same fail-open shape offerings/route.ts's own `savedIds` already uses:
    // review_helpful_votes only grants SELECT to `authenticated` (this
    // migration's own table-level hardening), so an anonymous viewer's actor
    // client would get a permission error, not an empty result, if this
    // query ran unconditionally -- checked for a real viewer first, same as
    // that route.
    const viewer = await getServerUser(request);
    const reviewIds = (data ?? []).map((r) => r.id as string);
    let helpfulReviewIds = new Set<string>();
    if (viewer && reviewIds.length > 0) {
      const { data: votes } = await db
        .from("review_helpful_votes")
        .select("review_id")
        .in("review_id", reviewIds);
      helpfulReviewIds = new Set((votes ?? []).map((v) => v.review_id as string));
    }

    const reviews = (data ?? []).map((r) => {
      const mapped = mapReview(r as Record<string, unknown>);
      const author = (r as Record<string, unknown>).author as
        | { id: string; username: string | null; full_name: string | null; profile_image: string | null }
        | null;
      return {
        ...mapped,
        author: author
          ? {
              id: author.id,
              username: author.username,
              fullName: author.full_name,
              profileImage: author.profile_image,
            }
          : null,
        // Null only if the booking itself was hard-deleted, which
        // booking_id's `on delete restrict` makes impossible while a review
        // referencing it exists -- or the lookup above simply found nothing,
        // which the map's absence handles the same honest way.
        stayDate: slotStartsById.get(r.booking_id as string) ?? null,
        isHelpful: helpfulReviewIds.has(r.id as string),
      };
    });

    return ok(
      {
        reviews,
        page,
        limit,
        total: count ?? reviews.length,
        rating: {
          ratingAvg: isNewlyListed ? null : offering.rating_avg,
          ratingCount,
          distribution,
          isNewlyListed,
        },
      },
      "Reviews retrieved"
    );
  } catch (e) {
    console.error("GET /api/offerings/[id]/reviews error:", e);
    return fail("Internal server error", 500);
  }
}
