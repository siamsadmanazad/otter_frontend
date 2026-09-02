import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
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
// ?page=&limit=&sort=recent|rating (default recent)
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
    const sort = sp.get("sort") === "rating" ? "rating" : "recent";

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
         created_at, updated_at,
         author:profiles!offering_reviews_author_profile_id_fkey(id, username, full_name, profile_image)`,
        { count: "exact" }
      )
      .eq("offering_id", id)
      .eq("status", "PUBLISHED");

    query =
      sort === "rating"
        ? query.order("rating", { ascending: false }).order("created_at", { ascending: false })
        : query.order("created_at", { ascending: false });

    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) return fail(error.message, 500);

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
