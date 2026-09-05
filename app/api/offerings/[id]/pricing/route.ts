import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// /api/offerings/[id]/pricing — a listing's price tiers and seasons
// (business_post_polish.md Phase 4/5.2).
//
// Deliberately mirrors the availability route's shape: these are the same
// kind of thing — child rows of an offering, edited by the owner AFTER the
// listing exists, never during creation. See PricingEditorScreen's own note
// for why they cannot live in the composer.
//
// AUTHORIZATION IS RLS, not this file. offering_price_tiers/_seasons each
// carry an owner-only write policy and a visibility policy that inherits
// from `offerings`, so an actor client is enough: a non-owner's write is
// refused by the database, and a listing the caller cannot see reads back
// empty. The validation here exists to turn a constraint violation into a
// sentence, exactly as offering-fields.ts does for the depth fields.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid offering id", 400);

    const db = await createActorClient(_request);
    const [tiers, seasons] = await Promise.all([
      db.from("offering_price_tiers")
        .select("id, min_party, max_party, price_cents")
        .eq("offering_id", id)
        .order("min_party", { ascending: true }),
      db.from("offering_price_seasons")
        .select("id, label, starts_on, ends_on, price_cents")
        .eq("offering_id", id)
        .order("starts_on", { ascending: true }),
    ]);

    if (tiers.error) return fail(tiers.error.message, 400);
    if (seasons.error) return fail(seasons.error.message, 400);

    return ok(
      {
        tiers: (tiers.data ?? []).map((t) => ({
          id: t.id,
          minParty: t.min_party,
          maxParty: t.max_party,
          priceCents: t.price_cents,
        })),
        seasons: (seasons.data ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          startsOn: s.starts_on,
          endsOn: s.ends_on,
          priceCents: s.price_cents,
        })),
      },
      "Pricing rules"
    );
  } catch (e) {
    console.error("GET /api/offerings/[id]/pricing error:", e);
    return fail("Internal server error", 500);
  }
}

// POST — add one tier or one season.
//
// The overlap rules (opt_no_overlap / ops_no_overlap) are EXCLUDE constraints
// and are the real gate; this only translates their violation into something
// a host can act on. Re-implementing overlap detection here would be a second
// copy of a rule that must not drift, and it would still race under
// concurrent inserts where the constraint does not.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid offering id", 400);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const priceCents = Number(body.priceCents);
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      return fail("priceCents must be a whole number of minor units", 400);
    }

    const db = await createActorClient(request);

    if (body.kind === "TIER") {
      const minParty = Number(body.minParty);
      const maxParty =
        body.maxParty === null || body.maxParty === undefined
          ? null
          : Number(body.maxParty);

      if (!Number.isInteger(minParty) || minParty < 1 || minParty > 500) {
        return fail("The smallest party must be between 1 and 500", 400);
      }
      if (maxParty !== null && (!Number.isInteger(maxParty) || maxParty > 500)) {
        return fail("The largest party must be 500 or fewer", 400);
      }
      if (maxParty !== null && maxParty < minParty) {
        return fail("The largest party can't be smaller than the smallest", 400);
      }

      const { data, error } = await db
        .from("offering_price_tiers")
        .insert({
          offering_id: id,
          min_party: minParty,
          max_party: maxParty,
          price_cents: priceCents,
        })
        .select("id")
        .single();

      if (error) return fail(tierError(error.message), 400);
      return ok({ id: data.id }, "Tier added");
    }

    if (body.kind === "SEASON") {
      const startsOn = String(body.startsOn ?? "");
      const endsOn = String(body.endsOn ?? "");
      if (!DATE_RE.test(startsOn) || !DATE_RE.test(endsOn)) {
        return fail("Dates must look like 2026-12-01", 400);
      }
      if (endsOn < startsOn) {
        return fail("The end date can't be before the start date", 400);
      }
      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim().slice(0, 60)
          : null;

      const { data, error } = await db
        .from("offering_price_seasons")
        .insert({
          offering_id: id,
          label,
          starts_on: startsOn,
          ends_on: endsOn,
          price_cents: priceCents,
        })
        .select("id")
        .single();

      if (error) return fail(seasonError(error.message), 400);
      return ok({ id: data.id }, "Season added");
    }

    return fail("kind must be TIER or SEASON", 400);
  } catch (e) {
    console.error("POST /api/offerings/[id]/pricing error:", e);
    return fail("Internal server error", 500);
  }
}

// DELETE ?tierId= | ?seasonId=
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid offering id", 400);

    const sp = request.nextUrl.searchParams;
    const tierId = sp.get("tierId");
    const seasonId = sp.get("seasonId");

    const table = tierId ? "offering_price_tiers" : seasonId ? "offering_price_seasons" : null;
    const rowId = tierId ?? seasonId;
    if (!table || !rowId || !UUID_RE.test(rowId)) {
      return fail("Pass exactly one valid tierId or seasonId", 400);
    }

    // offering_id is in the filter as well as the row id: a row id alone
    // would let a caller delete a rule belonging to a DIFFERENT listing they
    // happen to own, which is not what this route claims to do. RLS still
    // refuses one they do not own at all.
    const { error } = await db_delete(request, table, rowId, id);
    if (error) return fail(error, 400);
    return ok({ id: rowId }, "Removed");
  } catch (e) {
    console.error("DELETE /api/offerings/[id]/pricing error:", e);
    return fail("Internal server error", 500);
  }
}

async function db_delete(
  request: NextRequest,
  table: string,
  rowId: string,
  offeringId: string
): Promise<{ error: string | null }> {
  const db = await createActorClient(request);
  const { error } = await db.from(table).delete().eq("id", rowId).eq("offering_id", offeringId);
  return { error: error?.message ?? null };
}

/** Constraint names -> sentences. The DB stays the gate; this is the voice. */
function tierError(msg: string): string {
  if (msg.includes("opt_no_overlap")) {
    return "That band overlaps one you already have — party sizes can only be priced once";
  }
  if (msg.includes("opt_min_chk") || msg.includes("opt_max_chk")) {
    return "Party sizes must be between 1 and 500";
  }
  return msg;
}

function seasonError(msg: string): string {
  if (msg.includes("ops_no_overlap")) {
    return "Those dates overlap a season you already have — each date can only be priced once";
  }
  if (msg.includes("ops_range_chk")) {
    return "The end date can't be before the start date";
  }
  return msg;
}
