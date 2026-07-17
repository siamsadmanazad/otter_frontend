import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/analytics/event  body: { name, properties? }
// Fire-and-forget product-analytics event log (Phase 7.4) — the first
// event-tracking primitive in the app (only Sentry-style error reporting
// existed before). Mirrors log_event's own contract: a bad/oversized name is
// silently dropped server-side, never a client-visible error, so
// instrumentation can never break the feature it's measuring.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name : "";
    const properties =
      body?.properties && typeof body.properties === "object" ? body.properties : {};

    const supabase = await createActorClient(request);
    const { error } = await supabase.rpc("log_event", {
      p_name: name,
      p_properties: properties,
    });
    if (error) return fail(error.message, 500);
    return ok(null, "Logged");
  } catch (e) {
    console.error("POST /api/analytics/event error:", e);
    return fail("Failed logging event", 500);
  }
}
