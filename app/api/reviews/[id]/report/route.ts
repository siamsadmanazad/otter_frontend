import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// bussinesstemplate.md Phase F.4 · POST /api/reviews/[id]/report
//
// body { reason? }
//
// Mirrors POST /api/report (the general-purpose report endpoint, which
// already accepts relatedOffering the same way) rather than reusing it
// directly -- a dedicated route means a review's report shape never has to
// carry every OTHER report target's optional fields, and `scope` here is
// always the same literal, not a value the client picks.
//
// Uses the admin client, matching every other /api/report write -- `reports`
// has no INSERT policy for `authenticated` for the general route either, so
// this isn't a new posture.
//
// ⚠️ Deliberately NOT wired into any auto-suspend/escalation logic. See
// 20260903130000_reports_related_offering_review.sql: three reports on a
// LISTING auto-pauses it (offerings_report_autosuspend); three reports on
// one REVIEW is a fact about the review, not grounds to pull the service off
// the market, and a review's own moderation consequence is Phase I's dispute
// queue, which doesn't exist yet. This route's entire job is recording the
// report so it exists for that queue once it does.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid review reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("reviews_report", user.id, request, 10, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : null;

    const admin = createAdminClient();

    // The review must actually exist -- a report pointing at nothing is not
    // a moderation record, it's noise, and `related_offering_review`'s FK
    // would refuse the insert anyway; checking first turns that into a clean
    // 404 rather than a raw constraint-violation message.
    const { data: review, error: reviewErr } = await admin
      .from("offering_reviews")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (reviewErr) return fail(reviewErr.message, 500);
    if (!review) return fail("Review not found", 404);

    const { data, error } = await admin
      .from("reports")
      .insert({
        reported_by: user.profileId,
        scope: "Review",
        reason: reason || "Reported from a service review",
        reason_description: reason,
        related_offering_review: id,
        status: "PENDING",
      })
      .select("id, status, created_at")
      .single();

    if (error) return fail(error.message, 500);

    return ok(
      { id: data.id, status: data.status, createdAt: data.created_at },
      "Report submitted"
    );
  } catch (e) {
    console.error("POST /api/reviews/[id]/report error:", e);
    return fail("Internal server error", 500);
  }
}
