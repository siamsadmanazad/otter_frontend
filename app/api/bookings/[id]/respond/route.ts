import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { mapBookingError } from "@/lib/api/booking-errors";
import { mapBooking } from "@/lib/api/booking-mapper";

// POST /api/bookings/[id]/respond  body { accept: boolean, note? }
//
// bussinesstemplate.md D.3/D.6. Host-only (respond_to_booking() enforces
// current_profile_id() = business_id -- single-arm, acting-as-the-business,
// matching offerings/offering_slots/offering_availability_rules), and only
// valid on a PENDING_APPROVAL booking.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!id) return fail("Invalid booking reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("bookings_respond", user.id, request, 30, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.accept !== "boolean") {
      return fail("accept (true/false) is required", 400);
    }
    const note = typeof body.note === "string" ? body.note : null;

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("respond_to_booking", {
      p_booking_id: id,
      p_accept: body.accept,
      p_note: note,
    });

    if (error) {
      const { status, message } = mapBookingError(error.message);
      return fail(message, status);
    }

    return ok(mapBooking(data as Record<string, unknown>), body.accept ? "Booking accepted" : "Booking declined");
  } catch (e) {
    console.error("POST /api/bookings/[id]/respond error:", e);
    return fail("Internal server error", 500);
  }
}
