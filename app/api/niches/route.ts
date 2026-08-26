import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/niches -> the curated niche taxonomy (business_mode.md §4, the
// filter spine). Public reference data (niches_select_all: using (true)) --
// no auth check needed, matching the table's own RLS posture.
export async function GET(request: NextRequest): Promise<Response> {
  const db = await createActorClient(request);
  const { data, error } = await db
    .from("niches")
    .select("id, slug, display_name, color_hex, icon_key")
    .eq("is_active", true)
    .order("sort_order");
  if (error) return fail(error.message, 500);

  return ok(data ?? [], "Niches fetched");
}
