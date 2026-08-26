import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/business/profiles -> every profile the caller may act as (their
// own EXPLORER profile plus any BUSINESS they staff), source-of-truth for the
// profile switcher (business_mode.md Phase 1.2).
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("my_profiles");
  if (error) return fail(error.message, 500);

  return ok(data ?? [], "Profiles fetched");
}
