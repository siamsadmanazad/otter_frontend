import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { mapBooking } from "@/lib/api/booking-mapper";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/bookings/[id]
//
// bussinesstemplate.md D.6 lists this as two routes -- GET .../[id] and
// GET .../[code] -- but Next.js refuses two different dynamic segment names
// at the same path level ([id] and [code] can't coexist as siblings). Merged
// into one: [id] accepts either the booking's UUID OR its human-readable
// code (TO-XXXXXX) -- a traveller reading their code back to support staff
// and a client resolving its own stored id both reach the same place.
//
// No explicit ownership check here beyond RLS: bookings_select_own already
// scopes this to the buyer or the business, so a booking that exists but
// isn't the caller's returns the same "not found" a genuinely missing one
// would -- the same "absence and denial are indistinguishable to a prober"
// convention this codebase already uses elsewhere.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!id) return fail("Invalid booking reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const db = await createActorClient(request);
    const column = UUID_RE.test(id) ? "id" : "code";
    const { data, error } = await db.from("bookings").select("*").eq(column, id).maybeSingle();

    if (error) return fail(error.message, 500);
    if (!data) return fail("Booking not found", 404);

    // E.10: the platform take-rate, so a price breakdown can name it without
    // a second round trip. Additive (S16) -- an old client that never reads
    // this field is unaffected. The RATE is public (platform_fee_settings is
    // world-readable); what this particular booking was charged lives on its
    // ledger row behind the ledger's own RLS, and is deliberately not here.
    const { data: feeSettings } = await db
      .from("platform_fee_settings")
      .select("fee_bps")
      .maybeSingle();

    return ok(
      { ...mapBooking(data), platformFeeBps: feeSettings?.fee_bps ?? 0 },
      "Booking retrieved"
    );
  } catch (e) {
    console.error("GET /api/bookings/[id] error:", e);
    return fail("Internal server error", 500);
  }
}
