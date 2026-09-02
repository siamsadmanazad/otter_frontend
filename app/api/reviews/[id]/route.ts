import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { mapReviewError } from "@/lib/api/review-errors";
import { mapReview } from "@/lib/api/review-mapper";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// bussinesstemplate.md Phase F.4 · PATCH /api/reviews/[id]
//
// body { rating?, accuracyRating?, valueRating?, hostRating?, body?, media? }
//
// D18: editable for 48h (edited_until), author-only. RLS
// (offering_reviews_update_author) and offering_reviews_guard_update() (the
// F.1 trigger) both enforce this, but this route checks
// author_profile_id === user.profileId EXPLICITLY first anyway -- S2's
// discipline, and the refund route's own comment states the reason
// precisely: "a route that forwards an unauthorised call and lets the
// database sort it out is S2's exact complaint." The DB is still the real
// gate; this is a clean 403 instead of forwarding a stranger's PATCH to it.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid review reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("reviews_update", user.id, request, 20, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const db = await createActorClient(request);

    // ── S2: explicit ownership check before touching the row ────────────────
    const { data: existing, error: fetchError } = await db
      .from("offering_reviews")
      .select("id, author_profile_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) return fail(fetchError.message, 500);
    if (!existing) return fail("Review not found", 404);
    if (existing.author_profile_id !== user.profileId) {
      return fail("Only the person who wrote this review can edit it.", 403);
    }

    const update: Record<string, unknown> = {};

    if (body.rating !== undefined) {
      const rating = Number(body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return fail("rating must be a whole number from 1 to 5", 400);
      }
      update.rating = rating;
    }

    const subScore = (v: unknown, field: string): number | null => {
      if (v === null) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        throw new Error(`${field} must be a whole number from 1 to 5`);
      }
      return n;
    };
    try {
      if (body.accuracyRating !== undefined) {
        update.accuracy_rating = subScore(body.accuracyRating, "accuracyRating");
      }
      if (body.valueRating !== undefined) {
        update.value_rating = subScore(body.valueRating, "valueRating");
      }
      if (body.hostRating !== undefined) {
        update.host_rating = subScore(body.hostRating, "hostRating");
      }
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Invalid sub-rating", 400);
    }

    if (body.body !== undefined) {
      if (body.body === null) {
        update.body = null;
      } else if (typeof body.body === "string") {
        const trimmed = body.body.trim();
        if (trimmed.length > 2000) return fail("Review text is too long (max 2000 characters)", 400);
        update.body = trimmed.length > 0 ? trimmed : null;
      } else {
        return fail("body must be text", 400);
      }
    }

    if (body.media !== undefined) {
      if (body.media === null) {
        update.media = [];
      } else if (
        Array.isArray(body.media) &&
        body.media.every((m: unknown) => typeof m === "string")
      ) {
        if (body.media.length > 6) return fail("At most 6 media items per review", 400);
        update.media = body.media;
      } else {
        return fail("media must be a list of URLs", 400);
      }
    }

    if (Object.keys(update).length === 0) {
      return fail("Nothing to update", 400);
    }

    const { data, error } = await db
      .from("offering_reviews")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      const { status, message } = mapReviewError(error.message);
      return fail(message, status);
    }

    return ok(mapReview(data), "Review updated");
  } catch (e) {
    console.error("PATCH /api/reviews/[id] error:", e);
    return fail("Internal server error", 500);
  }
}
