import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/admin/media-storage?limit=20
//   -> { summary: admin_media_storage_summary(), topOwners: admin_media_storage_by_owner(limit) }
//
// media-compression-audit item 5 (MEDIA.md §8): "a sum(size_bytes) by
// owner_id view, so a single user cannot quietly become 5% of the bill."
// Scoped to the `posts`-bucket `media` table only -- chat attachments are
// Supabase-only forever (a locked decision) and have their own separate
// retention lever (chat_retention_settings), not this one.
export async function GET(request: NextRequest): Promise<Response> {
  const admin = await getAdminUser(request);
  if (!admin) return fail("Forbidden", 403);

  const limitParam = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) ? limitParam : 20;

  const db = createAdminClient();
  const [summary, topOwners] = await Promise.all([
    db.rpc("admin_media_storage_summary"),
    db.rpc("admin_media_storage_by_owner", { p_limit: limit }),
  ]);
  if (summary.error) return fail(summary.error.message, 500);
  if (topOwners.error) return fail(topOwners.error.message, 500);

  return ok({ summary: summary.data, topOwners: topOwners.data }, "Media storage fetched");
}
