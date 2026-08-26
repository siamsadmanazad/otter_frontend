import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/business/switch  body { profileId } -> sets which profile the
// caller is acting as (business_mode.md Phase 1.2). switch_profile() validates
// membership server-side and raises PROFILE_FORBIDDEN if the caller may not
// act as profileId.
//
// This only updates the `active_profile` row -- it does NOT itself change the
// caller's current session. The client MUST refresh its session afterwards
// (supabase.auth.refreshSession()) to mint a new JWT carrying the updated
// acting_profile claim; the custom_access_token_hook is what actually reads
// active_profile, and it only runs at token-mint time.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => null);
  const profileId = typeof body?.profileId === "string" ? body.profileId : "";
  if (!profileId) return fail("profileId is required", 400);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("switch_profile", { p_profile: profileId });
  if (error) {
    const status = error.message === "PROFILE_FORBIDDEN" ? 403 : 500;
    return fail(error.message, status);
  }

  return ok({ profileId: data }, "Switched");
}
