import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

// POST /api/business/subscribe  body { successUrl, cancelUrl }
// Business Mode Phase 7.2 — starts a Stripe Checkout session for the caller's
// ACTING business's single subscription tier. DORMANT by design: with no
// STRIPE_SECRET_KEY/STRIPE_PRICE_ID configured (the shipped state — see
// .env.example), this fails closed with 503 rather than attempting a call
// with no key. Even once keys exist, subscription_gate_settings.enabled
// (default false) is what actually decides whether any gated feature checks
// the resulting entitlement — this route existing and working is not the
// same as the paywall being live.
//
// Uses the admin client for the one write this route needs (bootstrapping
// business_subscriptions.stripe_customer_id) because `authenticated` has no
// insert/update policy on that table at all (by design — see the migration
// comment: only a trusted server path may write it). The actual status sync
// (active/past_due/canceled) happens in /api/webhooks/stripe, the ONLY
// place that ever sets `status`.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secretKey || !priceId) return fail("Billing is not yet configured", 503);

  const limited = await enforceRateLimit("business_subscribe", user.id, request, 5, 60);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const successUrl = typeof body?.successUrl === "string" ? body.successUrl : "";
  const cancelUrl = typeof body?.cancelUrl === "string" ? body.cancelUrl : "";
  if (!successUrl || !cancelUrl) return fail("successUrl and cancelUrl are required", 400);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, kind, username")
    .eq("id", user.profileId)
    .maybeSingle();
  if (!profile || profile.kind !== "BUSINESS") {
    return fail("Switch to the business you want to subscribe first", 400);
  }
  const { data: businessProfile } = await admin
    .from("business_profiles")
    .select("contact_email")
    .eq("profile_id", user.profileId)
    .maybeSingle();

  const stripe = new Stripe(secretKey);

  const { data: existing } = await admin
    .from("business_subscriptions")
    .select("stripe_customer_id")
    .eq("business_profile_id", user.profileId)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: businessProfile?.contact_email ?? undefined,
      name: profile.username,
      metadata: { business_profile_id: user.profileId },
    });
    customerId = customer.id;
    await admin
      .from("business_subscriptions")
      .upsert({ business_profile_id: user.profileId, stripe_customer_id: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.profileId,
    metadata: { business_profile_id: user.profileId },
    // Stamped onto the resulting Subscription object too (not just this
    // Session), so customer.subscription.updated/deleted webhooks — which
    // never see the Session — can still resolve the business directly
    // instead of falling back to a lookup by stripe_subscription_id.
    subscription_data: { metadata: { business_profile_id: user.profileId } },
  });

  return ok({ url: session.url }, "Checkout session created");
}
