import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// GET /api/service-forms  -> the whole type x form catalogue
//
// bussinesstemplate.md B.1/B.6. The composer renders its "what kind?" picker
// from this rather than a hardcoded list, so the enum, the labels and the UI
// cannot drift apart -- the same reason `niches` is fetched rather than
// compiled in.
//
// Returned whole (33 rows) rather than per-type: it is smaller than the
// request that would fetch one slice of it, and the composer lets a host
// change type without a second round trip.
//
// Public and unauthenticated, matching /api/niches -- this is a catalogue,
// not anyone's data.
export async function GET(_request: NextRequest): Promise<Response> {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("service_forms")
      .select("type, form, label, hint, sort_order")
      .order("type")
      .order("sort_order");

    if (error) return fail(error.message, 500);

    const mapped = (data ?? []).map((r) => ({
      type: r.type,
      form: r.form,
      label: r.label,
      hint: r.hint,
    }));

    return ok(mapped, "Service forms retrieved");
  } catch (e) {
    console.error("GET /api/service-forms error:", e);
    return fail("Internal server error", 500);
  }
}
