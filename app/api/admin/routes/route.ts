import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/admin/routes -> admin_list_pending_routes() (Phase 7's admin-only V1 verification)
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await getAdminUser(request);
  if (!admin) return fail("Forbidden", 403);

  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_list_pending_routes", { p_limit: 50 });
  if (error) return fail(error.message, 500);

  return ok(data ?? [], "Pending routes fetched");
}
