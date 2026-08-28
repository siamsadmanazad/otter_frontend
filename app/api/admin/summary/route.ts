import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/admin/summary -> admin_moderation_summary() (Phase 11, gamify.md §64)
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await getAdminUser(request);
  if (!admin) return fail("Forbidden", 403);

  const db = createAdminClient();
  const { data, error } = await db.rpc("admin_moderation_summary");
  if (error) return fail(error.message, 500);

  return ok(data, "Summary fetched");
}
