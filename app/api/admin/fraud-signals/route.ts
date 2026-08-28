import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/admin/fraud-signals -> admin_list_fraud_signals() (Phase 10/11, §54)
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await getAdminUser(request);
  if (!admin) return fail("Forbidden", 403);

  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_list_fraud_signals", { p_limit: 50 });
  if (error) return fail(error.message, 500);

  return ok(data ?? [], "Fraud signals fetched");
}
