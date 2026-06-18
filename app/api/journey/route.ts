import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/journey?id=<ownerId> -> that user's JOURNAL posts (journals are posts with post_type=JOURNAL)
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const ownerId = request.nextUrl.searchParams.get("id") || user.id;
    const db = createAdminClient();
    const { data } = await db
      .from("posts")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("post_type", "JOURNAL")
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
    const journals = await Promise.all(
      ids.map(async (id) => (await db.rpc("build_post_json", { p_post_id: id })).data)
    );
    return ok(journals.filter(Boolean), "get journals");
  } catch (e) {
    console.error("GET /api/journey error:", e);
    return fail("Internal server error", 500);
  }
}
