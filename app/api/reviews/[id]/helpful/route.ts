import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { mapReviewError } from "@/lib/api/review-errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// bussinesstemplate.md Phase G.4 · POST /api/reviews/[id]/helpful
//
// Toggles the caller's "this helped me" mark via toggle_review_helpful()
// (20260903190000_review_helpful.sql) -- thin over that RPC by design, the
// same shape /api/offerings/save is thin over toggle_saved_offering(). Every
// real rule (auth, review must exist and be PUBLISHED, a review's own author
// may not vote on it) lives in the RPC, not here -- this route's only job is
// turning its raised codes into a sentence via mapReviewError().
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid review reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // Same budget as reviews_reply -- a helpful-vote toggle is exactly as
    // cheap to spam and deserves no larger an allowance.
    const limited = await enforceRateLimit("reviews_helpful", user.id, request, 20, 300);
    if (limited) return limited;

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("toggle_review_helpful", { p_review_id: id });
    if (error) {
      const { status, message } = mapReviewError(error.message);
      return fail(message, status);
    }

    return ok(data, "Helpful vote updated");
  } catch (e) {
    console.error("POST /api/reviews/[id]/helpful error:", e);
    return fail("Internal server error", 500);
  }
}
