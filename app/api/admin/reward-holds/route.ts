import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

const STATUSES = new Set(["PENDING", "RELEASED", "REJECTED"]);

// GET /api/admin/reward-holds?status=PENDING -> admin_list_reward_holds()
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await getAdminUser(request);
  if (!admin) return fail("Forbidden", 403);

  const status = (request.nextUrl.searchParams.get("status") ?? "PENDING").toUpperCase();
  if (!STATUSES.has(status)) return fail("Invalid status", 400);

  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_list_reward_holds", {
    p_status: status,
    p_limit: 50,
  });
  if (error) return fail(error.message, 500);

  return ok(data ?? [], "Reward holds fetched");
}
