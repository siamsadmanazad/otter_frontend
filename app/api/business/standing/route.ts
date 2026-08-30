import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/business/standing
// business_identity_and_standing.md Track C — the caller's ACTING business's
// own Standing (XP/level), via my_business_standing(). Owner/staff only —
// unlike merits/signals, XP is never shown to a visitor (the doc's "hide the
// XP bar from visitors" rule), so this route requires auth and returns only
// the caller's own acting profile's row, same convention as
// /api/business/analytics (no businessId in the request).
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("my_business_standing");
  if (error) {
    const status = error.message === "FORBIDDEN" ? 403 : 400;
    return fail(error.message, status);
  }
  return ok(data, "Standing retrieved");
}
