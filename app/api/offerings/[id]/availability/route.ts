import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RULE_KINDS = new Set(["WEEKLY", "DATE_RANGE", "BLACKOUT"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// GET /api/offerings/[id]/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// bussinesstemplate.md C.5 — what a traveller can book, and when.
//
// PUBLIC and unauthenticated: someone has to be able to see a calendar before
// deciding to sign up. It carries NO buyer identity — the slots table itself
// only holds counts, so there is no field here that could leak who booked
// (the shape enforces C.5's privacy requirement rather than this route
// remembering to omit a column).
//
// `seatsLeft` is derived rather than exposing held/sold separately: a
// traveller needs to know whether they can book, not how the host's inventory
// is split between unpaid holds and confirmed sales.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid service ID format", 400);

    const sp = request.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");
    if (from && !DATE_RE.test(from)) return fail("from must be YYYY-MM-DD", 400);
    if (to && !DATE_RE.test(to)) return fail("to must be YYYY-MM-DD", 400);

    const db = createAdminClient();

    // The service's own zone, so the client can render its dates in the time
    // the host actually meant (C.9) rather than the viewer's.
    const { data: offering } = await db
      .from("offerings")
      .select("timezone, status")
      .eq("id", id)
      .maybeSingle();
    if (!offering) return fail("Service not found", 404);

    let q = db
      .from("offering_slots")
      .select(
        "id, starts_at, ends_at, capacity_total, capacity_held, capacity_sold, price_override_minor, status"
      )
      .eq("offering_id", id)
      .eq("status", "OPEN")
      // Never offer a slot in the past, whatever the caller asked for.
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      // A calendar is browsed a month at a time; an unbounded query on a
      // 180-day horizon with several rules is a page nobody reads.
      .limit(400);

    if (from) q = q.gte("starts_at", `${from}T00:00:00Z`);
    if (to) q = q.lte("starts_at", `${to}T23:59:59Z`);

    const { data, error } = await q;
    if (error) return fail(error.message, 500);

    const slots = (data ?? []).map((s) => ({
      id: s.id,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      // Derived on purpose — see the note above.
      seatsLeft: s.capacity_total - s.capacity_held - s.capacity_sold,
      capacityTotal: s.capacity_total,
      priceOverrideMinor: s.price_override_minor,
    }));

    return ok({ timezone: offering.timezone, slots }, "Availability retrieved");
  } catch (e) {
    console.error("GET /api/offerings/[id]/availability error:", e);
    return fail("Internal server error", 500);
  }
}

// PUT /api/offerings/[id]/availability  body { rules: [...] }
//
// bussinesstemplate.md C.6 — replaces this service's whole rule set.
//
// REPLACE rather than patch, deliberately: availability is a small set a host
// edits as a whole ("Fri and Sat, but closed that week in April"), and a
// per-rule PATCH API would need ids the editor does not naturally have. The
// slots are NOT rebuilt from scratch — the materialiser trigger reconciles
// them, keeping every booked slot (C.2).
//
// Authorization is the actor client: `offering_rules_owner_all` requires
// `owner_profile_id = current_profile_id()`, so a caller who has not switched
// to the business cannot write, and RLS is the gate rather than this handler.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid service ID format", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // Rewriting a rule set re-materialises up to 180 days of slots, so it is
    // markedly more expensive than an ordinary write.
    const limited = await enforceRateLimit("availability_write", user.id, request, 20, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.rules)) return fail("rules must be a list", 400);
    if (body.rules.length > 40) return fail("At most 40 availability rules", 400);

    const rows: Record<string, unknown>[] = [];
    for (const raw of body.rules) {
      const r = raw as Record<string, unknown>;
      const kind = typeof r.kind === "string" ? r.kind.toUpperCase() : "";
      if (!RULE_KINDS.has(kind)) return fail("Invalid rule kind", 400);

      if (typeof r.validFrom !== "string" || !DATE_RE.test(r.validFrom)) {
        return fail("Every rule needs a start date", 400);
      }
      if (r.validTo != null && (typeof r.validTo !== "string" || !DATE_RE.test(r.validTo))) {
        return fail("validTo must be YYYY-MM-DD", 400);
      }
      if (r.validTo && (r.validTo as string) < r.validFrom) {
        return fail("A rule can't end before it starts", 400);
      }

      let weekdays: number[] | null = null;
      if (kind === "WEEKLY") {
        if (!Array.isArray(r.weekdays) || r.weekdays.length === 0) {
          return fail("A weekly rule needs at least one day", 400);
        }
        weekdays = (r.weekdays as unknown[]).map(Number);
        if (weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
          return fail("Weekdays must be 0 (Sunday) to 6", 400);
        }
        if (new Set(weekdays).size !== weekdays.length) {
          return fail("A day can't be listed twice", 400);
        }
      } else if (r.weekdays != null) {
        return fail("Only a weekly rule has weekdays", 400);
      }

      if (r.startTime != null && (typeof r.startTime !== "string" || !TIME_RE.test(r.startTime))) {
        return fail("startTime must look like 18:00", 400);
      }

      const num = (v: unknown, lo: number, hi: number, label: string) => {
        if (v == null) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(label);
        return n;
      };

      try {
        rows.push({
          offering_id: id,
          kind,
          weekdays,
          start_time: r.startTime ?? null,
          duration_minutes: num(r.durationMinutes, 5, 43200, "durationMinutes must be 5-43200"),
          valid_from: r.validFrom,
          valid_to: r.validTo ?? null,
          capacity: num(r.capacity, 1, 500, "capacity must be 1-500"),
          lead_time_hours: num(r.leadTimeHours, 0, 8760, "leadTimeHours must be 0-8760") ?? 0,
          cutoff_hours: num(r.cutoffHours, 0, 8760, "cutoffHours must be 0-8760") ?? 0,
        });
      } catch (e) {
        return fail((e as Error).message, 400);
      }
    }

    const db = await createActorClient(request);

    // Ownership is RLS's job. This read exists only so a caller who is not the
    // owner gets 403 rather than a silent no-op delete of zero rows.
    const { data: owned } = await db.from("offerings").select("id").eq("id", id).maybeSingle();
    if (!owned) return fail("Service not found", 404);

    const { error: delErr } = await db
      .from("offering_availability_rules")
      .delete()
      .eq("offering_id", id);
    if (delErr) return fail(delErr.message, 403);

    if (rows.length > 0) {
      const { error: insErr } = await db.from("offering_availability_rules").insert(rows);
      if (insErr) {
        if (insErr.message.includes("DUPLICATE_WEEKDAY")) {
          return fail("A day can't be listed twice", 400);
        }
        return fail(insErr.message, 400);
      }
    }

    // The insert/delete trigger already re-materialised. Report what a host
    // will actually see, so an empty calendar is visible here rather than
    // discovered later.
    const { count } = await createAdminClient()
      .from("offering_slots")
      .select("id", { count: "exact", head: true })
      .eq("offering_id", id)
      .eq("status", "OPEN");

    return ok({ rules: rows.length, openSlots: count ?? 0 }, "Availability saved");
  } catch (e) {
    console.error("PUT /api/offerings/[id]/availability error:", e);
    return fail("Internal server error", 500);
  }
}
