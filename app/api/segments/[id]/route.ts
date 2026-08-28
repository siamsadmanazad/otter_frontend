import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/segments/:id -> segment_detail() (Otter Trails Phase 9, gamify.md §9)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("segment_detail", { p_id: id });
    if (error) return fail(error.message, 500);
    if (!data) return fail("Segment not found", 404);

    return ok(data, "Segment retrieved");
  } catch (e) {
    console.error("GET /api/segments/[id] error:", e);
    return fail("Internal server error", 500);
  }
}
