import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { mapBookingError } from "@/lib/api/booking-errors";
import { mapBooking } from "@/lib/api/booking-mapper";

// POST /api/bookings/[id]/cancel  body { reason? }
//
// bussinesstemplate.md D.3/D.6. Callable by the buyer OR the business --
// cancel_booking() itself is the authority check (current_profile_id() must
// equal buyer_profile_id or business_id), this route just forwards the call.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!id) return fail("Invalid booking reference", 400);

    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const limited = await enforceRateLimit("bookings_cancel", user.id, request, 20, 300);
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason : null;

    const db = await createActorClient(request);
    const { data, error } = await db.rpc("cancel_booking", {
      p_booking_id: id,
      p_reason: reason,
    });

    if (error) {
      const { status, message } = mapBookingError(error.message);
      return fail(message, status);
    }

    return ok(mapBooking(data as Record<string, unknown>), "Booking cancelled");
  } catch (e) {
    console.error("POST /api/bookings/[id]/cancel error:", e);
    return fail("Internal server error", 500);
  }
}
