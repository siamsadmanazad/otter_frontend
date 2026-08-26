import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/http";

// POST /api/webhooks/stripe
// Business Mode Phase 7.2 — the ONLY place that ever writes
// business_subscriptions.status. Stripe calls this directly (no Supabase
// session), so auth is the webhook signature, not getServerUser. DORMANT
// with no STRIPE_WEBHOOK_SECRET configured (the shipped state) — returns 503
// rather than trusting an unverifiable request body.
//
// Reads the RAW body (not request.json()) because Stripe's signature is
// computed over the exact bytes it sent; parsing first and re-serializing
// would break verification.
export async function POST(request: NextRequest): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secretKey) return fail("Billing is not yet configured", 503);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return fail("Missing signature", 400);

  const rawBody = await request.text();
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    console.error("POST /api/webhooks/stripe signature verification failed:", e);
    return fail("Invalid signature", 400);
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.metadata?.business_profile_id ?? session.client_reference_id;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (businessId && subscriptionId && customerId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
        await admin.from("business_subscriptions").upsert({
          business_profile_id: businessId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: sub.status === "active" || sub.status === "trialing" ? "active" : sub.status,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const businessId = sub.metadata?.business_profile_id;
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
      const status =
        event.type === "customer.subscription.deleted"
          ? "canceled"
          : sub.status === "active" || sub.status === "trialing"
            ? "active"
            : sub.status === "past_due"
              ? "past_due"
              : "inactive";
      if (businessId) {
        await admin.from("business_subscriptions").upsert({
          business_profile_id: businessId,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
          stripe_subscription_id: sub.id,
          status,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        });
      } else {
        // Fall back to matching by subscription id when metadata wasn't
        // stamped on the Subscription object itself (only the Checkout
        // Session is guaranteed to carry it from /api/business/subscribe).
        await admin
          .from("business_subscriptions")
          .update({
            status,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          })
          .eq("stripe_subscription_id", sub.id);
      }
      break;
    }
    default:
      break; // Ignore event types we don't act on.
  }

  return ok(null, "Webhook processed");
}
