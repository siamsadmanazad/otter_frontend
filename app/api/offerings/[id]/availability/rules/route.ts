import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/offerings/[id]/availability/rules — the HOST's own read of what
// they set, as opposed to GET .../availability (C.5), which returns the
// SLOTS those rules produced.
//
// Deliberately a separate, AUTHENTICATED route rather than folding this into
// C.5's public one: "rules are the host's own working notes — a guest never
// needs to see the pattern, only the dates it produced" is the exact words
// the RLS policy comment on offering_availability_rules already carries.
// Bolting a rules array onto the public endpoint would leak a host's
// lead/cutoff hours and internal capacity overrides to anyone browsing.
//
// WHY THIS EXISTS AT ALL: PUT .../availability (C.6) REPLACES the whole rule
// set. Without a way to read the current set back, re-opening the editor
// would have to start blank, and a host who opened it just to add one
// blackout date would silently wipe their weekly pattern on save. RLS
// (`offering_rules_owner_all`) is the actual gate — a non-owner gets an
// empty list, not an error, matching this project's own "absence and denial
// are indistinguishable to a prober" convention.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid service ID format", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const db = await createActorClient(request);
    const { data, error } = await db
      .from("offering_availability_rules")
      .select(
        "id, kind, weekdays, start_time, duration_minutes, valid_from, valid_to, capacity, lead_time_hours, cutoff_hours"
      )
      .eq("offering_id", id)
      .order("valid_from");

    if (error) return fail(error.message, 500);

    const mapped = (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      weekdays: r.weekdays,
      startTime: r.start_time,
      durationMinutes: r.duration_minutes,
      validFrom: r.valid_from,
      validTo: r.valid_to,
      capacity: r.capacity,
      leadTimeHours: r.lead_time_hours,
      cutoffHours: r.cutoff_hours,
    }));

    return ok(mapped, "Availability rules retrieved");
  } catch (e) {
    console.error("GET /api/offerings/[id]/availability/rules error:", e);
    return fail("Internal server error", 500);
  }
}
