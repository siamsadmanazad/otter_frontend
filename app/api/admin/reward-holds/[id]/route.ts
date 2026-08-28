import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// PATCH /api/admin/reward-holds/:id  body { action: "release" | "reject" }
// -> release_reward_hold() / reject_reward_hold() (Phase 10, gamify.md §54/§55)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const admin = await getAdminUser(request);
  if (!admin) return fail("Forbidden", 403);

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "release" && action !== "reject") {
    return fail("action must be 'release' or 'reject'", 400);
  }

  const db = createAdminClient();
  const rpc = action === "release" ? "release_reward_hold" : "reject_reward_hold";
  const { data, error } = await db.rpc(rpc, { p_hold_id: id });
  if (error) {
    if (/HOLD_NOT_FOUND/i.test(error.message || "")) return fail("Hold not found or already resolved", 404);
    return fail(error.message, 500);
  }

  return ok(data, action === "release" ? "Reward released" : "Reward rejected");
}
