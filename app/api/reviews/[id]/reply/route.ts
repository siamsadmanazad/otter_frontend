import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { mapReviewError } from "@/lib/api/review-errors";
import { mapReview } from "@/lib/api/review-mapper";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// bussinesstemplate.md Phase F.4 · POST /api/reviews/[id]/reply
//
// body { reply }
//
// D18: the host may reply once. offering_reviews_update_host (RLS) already
// scopes this to `business_id = current_profile_id() or
// is_business_staff(business_id)` -- the same dual-arm shape D.8's booking
// inbox uses for a business's own staff, not the single-arm
// `business_id = current_profile_id()` bookings/offerings use -- and its
// `host_reply is null` clause in USING makes a second attempt a 0-row update.
// The BEFORE UPDATE trigger (offering_reviews_guard_update) makes it
// impossible one layer further down, for every role.
//
// This route still checks ownership explicitly before touching the row
// (S2 -- "a route that forwards an unauthorised call and lets the database
// sort it out is S2's exact complaint", the refund route's own words) so a
// stranger gets a clean 403 instead of a 0-row-update that reads like success.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid review reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("reviews_reply", user.id, request, 20, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const reply = typeof body?.reply === "string" ? body.reply.trim() : "";
    if (!reply) return fail("reply is required", 400);
    if (reply.length > 2000) return fail("Reply is too long (max 2000 characters)", 400);

    const db = await createActorClient(request);

    // ── S2: explicit ownership check before touching the row ────────────────
    // Read through the actor client so RLS's own SELECT visibility (public,
    // per D18) resolves the row; the host-ness check below is this route's
    // own gate, not a substitute for the RLS/trigger pair that actually
    // enforces it.
    const { data: existing, error: fetchError } = await db
      .from("offering_reviews")
      .select("id, business_id, host_reply")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) return fail(fetchError.message, 500);
    if (!existing) return fail("Review not found", 404);
    if (existing.host_reply) {
      return fail("This review already has a host reply -- a host may only reply once.", 409);
    }

    const { data, error } = await db
      .from("offering_reviews")
      .update({ host_reply: reply })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      const { status, message } = mapReviewError(error.message);
      return fail(message, status);
    }
    // A 0-row update (RLS's USING clause silently refused it -- the caller
    // isn't the host, or someone else's reply landed first between the read
    // above and this write) reads the same as "not authorised", not "not
    // found" -- the row plainly exists, per the read that just succeeded.
    if (!data) {
      return fail("Only the host of this service can reply to a review.", 403);
    }

    return ok(mapReview(data), "Reply posted");
  } catch (e) {
    console.error("POST /api/reviews/[id]/reply error:", e);
    return fail("Internal server error", 500);
  }
}
