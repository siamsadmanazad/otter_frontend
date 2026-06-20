import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/locations?location=<q> -> matching locations (reference dataset)
export async function GET(request: NextRequest): Promise<Response> {
  const locationName = request.nextUrl.searchParams.get("location");
  if (locationName !== null && locationName.trim() === "") {
    return ok([], "Empty location parameter provided");
  }
  try {
    const db = createAdminClient();
    let q = db.from("locations").select("*").limit(50);
    if (locationName) q = q.ilike("location", `%${locationName}%`);
    const { data, error } = await q;
    if (error) return fail("Failed to retrieve location(s)", 500);
    return ok(data ?? [], locationName ? `Found location(s) for "${locationName}"` : "Got all locations");
  } catch (e) {
    console.error("GET /api/locations error:", e);
    return fail("Failed to retrieve location(s)", 500);
  }
}
