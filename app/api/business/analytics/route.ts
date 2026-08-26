import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/business/analytics?days=&offeringId=
// Business Mode Phase 6.1 — the caller's ACTING business's analytics
// (funnel + discovery source), via business_analytics()/
// business_analytics_sources(). Targets user.profileId directly, same
// convention as /api/business/staff -- no businessId in the request, the
// RPCs' own dual-arm ownership check is the real gate (raises FORBIDDEN if
// the caller isn't that business or its staff, mapped to 403 here).
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const daysRaw = Number(request.nextUrl.searchParams.get("days"));
  const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 366 ? daysRaw : 30;

  const offeringIdRaw = request.nextUrl.searchParams.get("offeringId");
  const offeringId = offeringIdRaw && UUID_RE.test(offeringIdRaw) ? offeringIdRaw : null;

  const db = await createActorClient(request);
  const [funnel, sources] = await Promise.all([
    db.rpc("business_analytics", {
      p_business: user.profileId,
      p_days: days,
      p_offering: offeringId,
    }),
    db.rpc("business_analytics_sources", {
      p_business: user.profileId,
      p_days: days,
    }),
  ]);

  if (funnel.error) {
    return fail(funnel.error.message, funnel.error.message === "FORBIDDEN" ? 403 : 400);
  }
  if (sources.error) {
    return fail(sources.error.message, sources.error.message === "FORBIDDEN" ? 403 : 400);
  }

  const rows = (funnel.data ?? []).map((r: Record<string, unknown>) => ({
    offeringId: r.offering_id,
    offeringTitle: r.offering_title,
    day: r.day,
    impressions: r.impressions,
    detailViews: r.detail_views,
    saves: r.saves,
    enquiries: r.enquiries,
    bookings: r.bookings,
  }));
  const sourceRows = (sources.data ?? []).map((r: Record<string, unknown>) => ({
    source: r.source,
    impressions: r.impressions,
  }));

  return ok({ funnel: rows, sources: sourceRows }, "Analytics retrieved");
}
