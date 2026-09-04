import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/comments/[id]/report
//
// body { reason? }
//
// Mirrors POST /api/reviews/[id]/report exactly -- a dedicated route so
// `scope` is a literal the server controls, never a value the client picks
// (the generic POST /api/report accepts any free-text scope; this route
// exists so "Comment" is at least ONE scope that's actually validated at
// its entry point). Uses the admin client, same reason: `reports` has no
// INSERT policy for `authenticated`.
//
// The actual moderation consequence (3+ distinct reporters auto-hides the
// comment) lives entirely in the DB trigger
// (comments_report_autohide(), 20260903200000_comments_moderation.sql) --
// this route's only job is recording a well-formed report; it never reads
// the resulting comment status back.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid comment reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("comments_report", user.id, request, 10, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : null;

    const admin = createAdminClient();

    // The comment must exist AND still be PUBLISHED -- an already-HIDDEN or
    // REMOVED comment has nothing left for a report to accomplish, and a
    // report pointing at nothing would just be noise (same reasoning the
    // review-report route uses for its own existence check).
    const { data: comment, error: commentErr } = await admin
      .from("comments")
      .select("id, owner_id, status")
      .eq("id", id)
      .maybeSingle();
    if (commentErr) return fail(commentErr.message, 500);
    if (!comment) return fail("Comment not found", 404);
    if (comment.status !== "PUBLISHED") {
      return fail("This comment isn't available to report.", 409);
    }

    // S2: an explicit check before touching the row, not left to the DB to
    // sort out -- same posture as F.3's self-review refusal. A comment's own
    // author reporting themselves is either a no-op or a way to game the
    // "distinct reporters" threshold in reverse; refused either way.
    if (comment.owner_id === user.profileId) {
      return fail("You can't report your own comment.", 403);
    }

    const { data, error } = await admin
      .from("reports")
      .insert({
        reported_by: user.profileId,
        reported_user: comment.owner_id,
        scope: "Comment",
        reason: reason || "Reported from a comment",
        reason_description: reason,
        related_comment: id,
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
    console.error("POST /api/comments/[id]/report error:", e);
    return fail("Internal server error", 500);
  }
}
