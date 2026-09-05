import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/offerings/[id]/quote?partySize=2&slotId=<uuid>
//
// business_post_polish.md Phase 3.3 — the price breakdown the booking-review
// screen renders BEFORE a booking exists: total, what is charged online now
// (the deposit), and what the guest settles with the host in person.
//
// This route exists so the CLIENT NEVER COMPUTES MONEY (D8/H5). The screen
// used to derive its own total from price x party; the moment a deposit split
// entered the picture, a second implementation of "what is the deposit" would
// have existed on the client and could drift from the one create_booking()
// actually charges. quote_offering_price() and create_booking() share
// offering_deposit_minor(), so what is shown and what is taken are the same
// arithmetic by construction.
//
// SECURITY INVOKER inside the function: RLS decides what can be quoted, so a
// listing the caller cannot see quotes nothing. No auth requirement here
// beyond that -- a public price is public.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail("Invalid offering id", 400);

    const sp = request.nextUrl.searchParams;
    const partySize = Number(sp.get("partySize") ?? "1");
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 500) {
      return fail("partySize must be a whole number between 1 and 500", 400);
    }

    const slotId = sp.get("slotId");
    if (slotId && !UUID_RE.test(slotId)) return fail("Invalid slotId", 400);

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("quote_offering_price", {
      p_offering_id: id,
      p_party_size: partySize,
      p_slot_id: slotId,
    });

    if (error) return fail(error.message, 400);
    return ok(data, "Quote");
  } catch (e) {
    console.error("GET /api/offerings/[id]/quote error:", e);
    return fail("Internal server error", 500);
  }
}
