import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/radar/wave  body: { toUser, context? }
// Sends a wave (or returns one) via the radar_wave RPC — rate-limited,
// block-checked, wave-back aware (Otter Radar Phase 5.2). Returns
// { status: 'sent' | 'returned', waveId, otherUserId }. On 'returned' the
// client opens the DM (via /api/chat/conversations) — the chat hand-off.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const toUser = typeof body?.toUser === "string" ? body.toUser : "";
    if (!UUID_RE.test(toUser)) return fail("Invalid target", 400);
    const context =
      body?.context && typeof body.context === "object" ? body.context : {};

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_wave", {
      p_to_user: toUser,
      p_context: context,
    });
    if (error) {
      // Surface the RPC's own guardrails as friendly statuses.
      const msg = error.message || "";
      if (/rate limited/i.test(msg)) return fail("Slow down a little 👋", 429);
      if (/blocked/i.test(msg)) return fail("You can’t wave this explorer", 403);
      return fail(msg, 500);
    }
    return ok(data, "Wave sent");
  } catch (e) {
    console.error("POST /api/radar/wave error:", e);
    return fail("Failed sending wave", 500);
  }
}

// GET /api/radar/wave — my incoming waves (marks them seen) via
// radar_waves_inbox. Used to surface "someone waved at you" and offer a
// wave-back that opens chat.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_waves_inbox");
    if (error) return fail(error.message, 500);
    return ok(data ?? [], "Waves");
  } catch (e) {
    console.error("GET /api/radar/wave error:", e);
    return fail("Failed loading waves", 500);
  }
}
