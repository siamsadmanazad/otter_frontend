import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// POST /api/admin/routes/:id/verify -> admin_verify_route() (§27 admin-only
// verification + §28's verification payout, always together)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const admin = await getAdminUser(request);
  if (!admin) return fail("Forbidden", 403);

  const { id } = await params;
  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_verify_route", { p_route_id: id });
  if (error) {
    if (/ROUTE_NOT_FOUND/i.test(error.message || "")) return fail("Route not found", 404);
    return fail(error.message, 500);
  }

  return ok(data, "Route verified");
}
