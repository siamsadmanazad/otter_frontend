import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/offerings/save  body: { offeringId }
// Toggle a private bookmark on an offering (business_mode.md Phase 4.5) via
// the toggle_saved_offering RPC. Mirrors /api/radar/places/save exactly.
// Returns { isSaved }.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const offeringId = typeof body?.offeringId === "string" ? body.offeringId : "";
    if (!UUID_RE.test(offeringId)) return fail("Invalid offering", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("toggle_saved_offering", {
      p_offering_id: offeringId,
    });
    if (error) {
      if (/OFFERING_NOT_FOUND/i.test(error.message || "")) {
        return fail("Offering not found", 404);
      }
      return fail(error.message, 500);
    }
    return ok(data, "Saved");
  } catch (e) {
    console.error("POST /api/offerings/save error:", e);
    return fail("Failed saving offering", 500);
  }
}

// GET /api/offerings/save — the caller's saved offerings, via get_saved_offerings.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("get_saved_offerings");
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Saved offerings");
  } catch (e) {
    console.error("GET /api/offerings/save error:", e);
    return fail("Failed loading saved offerings", 500);
  }
}
