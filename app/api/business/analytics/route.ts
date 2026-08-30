import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 402 (Payment Required) for the Business Mode 7.2 gate — a no-op today
// since subscription_gate_settings.enabled ships false, but the right code
// once it's ever turned on.
function mapAnalyticsError(message: string): number {
  if (message === "FORBIDDEN") return 403;
  if (message === "SUBSCRIPTION_REQUIRED") return 402;
  return 400;
}

// GET /api/business/analytics?days=&offeringId=
// GET /api/business/analytics?summary=true[&days=]
// Business Mode Phase 6.1 — the caller's ACTING business's analytics
// (funnel + discovery source), via business_analytics()/
// business_analytics_sources(). Targets user.profileId directly, same
// convention as /api/business/staff -- no businessId in the request, the
// RPCs' own dual-arm ownership check is the real gate (raises FORBIDDEN if
// the caller isn't that business or its staff, mapped to 403 here).
//
// business_identity_and_standing.md B1 — `summary=true` is a separate cheap
// mode (single-row current+prior 7-day totals via business_analytics_
// summary()) for the profile hero's stats row, instead of shipping the full
// per-offering/per-day funnel just to render three numbers.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const daysRaw = Number(request.nextUrl.searchParams.get("days"));
  const db = await createActorClient(request);

  if (request.nextUrl.searchParams.get("summary") === "true") {
    const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 90 ? daysRaw : 7;
    const { data, error } = await db.rpc("business_analytics_summary", {
      p_business: user.profileId,
      p_days: days,
    });
    if (error) return fail(error.message, mapAnalyticsError(error.message));
    const row = (data ?? [])[0] ?? {
      impressions: 0,
      saves: 0,
      enquiries: 0,
      bookings: 0,
      prior_impressions: 0,
      prior_saves: 0,
      prior_enquiries: 0,
      prior_bookings: 0,
    };
    return ok(
      {
        impressions: row.impressions,
        saves: row.saves,
        enquiries: row.enquiries,
        bookings: row.bookings,
        priorImpressions: row.prior_impressions,
        priorSaves: row.prior_saves,
        priorEnquiries: row.prior_enquiries,
        priorBookings: row.prior_bookings,
      },
      "Analytics summary retrieved",
    );
  }

  const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 366 ? daysRaw : 30;

  const offeringIdRaw = request.nextUrl.searchParams.get("offeringId");
  const offeringId = offeringIdRaw && UUID_RE.test(offeringIdRaw) ? offeringIdRaw : null;

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
    return fail(funnel.error.message, mapAnalyticsError(funnel.error.message));
  }
  if (sources.error) {
    return fail(sources.error.message, mapAnalyticsError(sources.error.message));
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
