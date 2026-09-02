import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { mapBookingError } from "@/lib/api/booking-errors";
import { mapBooking } from "@/lib/api/booking-mapper";

// bussinesstemplate.md Phase D.6.
//
// POST /api/bookings
// body { offeringId, slotId, partySize, idempotencyKey, guestName?, guestPhone?, guestEmail?, guestNote? }
//
// Deliberately accepts NO amountMinor field at all (D13/S3) -- the amount is
// computed server-side, inside create_booking(), from the locked slot row.
// Nothing about "how much this costs" ever travels from client to server;
// only "how many people."
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("bookings_create", user.id, request, 10, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const offeringId = typeof body.offeringId === "string" ? body.offeringId : "";
    const slotId = typeof body.slotId === "string" ? body.slotId : "";
    const partySize = Number(body.partySize);
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

    if (!offeringId || !slotId) return fail("offeringId and slotId are required", 400);
    if (!Number.isInteger(partySize) || partySize < 1) {
      return fail("partySize must be a positive whole number", 400);
    }
    if (!idempotencyKey || idempotencyKey.length > 100) {
      return fail("idempotencyKey is required", 400);
    }

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("create_booking", {
      p_offering_id: offeringId,
      p_slot_id: slotId,
      p_party_size: partySize,
      p_idempotency_key: idempotencyKey,
      p_guest_name: typeof body.guestName === "string" ? body.guestName : null,
      p_guest_phone: typeof body.guestPhone === "string" ? body.guestPhone : null,
      p_guest_email: typeof body.guestEmail === "string" ? body.guestEmail : null,
      p_guest_note: typeof body.guestNote === "string" ? body.guestNote : null,
    });

    if (error) {
      const { status, message } = mapBookingError(error.message);
      return fail(message, status);
    }

    return ok(mapBooking(data as Record<string, unknown>), "Booking created");
  } catch (e) {
    console.error("POST /api/bookings error:", e);
    return fail("Internal server error", 500);
  }
}

// GET /api/bookings?as=buyer|host
//
// RLS (bookings_select_own) already scopes every row to
// buyer_profile_id = current_profile_id() OR business_id = current_profile_id()
// -- `as` only picks which HALF of that union the caller wants to see, it is
// not itself a security boundary. A caller who is neither (most people, most
// of the time) simply gets an empty list for either value.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const sp = request.nextUrl.searchParams;
    const as = sp.get("as") === "host" ? "host" : "buyer";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
    const from = (page - 1) * limit;

    const db = await createActorClient(request);
    const column = as === "host" ? "business_id" : "buyer_profile_id";
    const { data, error } = await db
      .from("bookings")
      .select("*")
      .eq(column, user.profileId)
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) return fail(error.message, 500);

    return ok((data ?? []).map(mapBooking), "Bookings retrieved");
  } catch (e) {
    console.error("GET /api/bookings error:", e);
    return fail("Internal server error", 500);
  }
}
