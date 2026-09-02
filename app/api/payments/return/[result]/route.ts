import { NextRequest, NextResponse } from "next/server";
import { timeRoute } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowed } from "@/lib/ratelimit";
import { logPaymentEvent, type PaymentEventType } from "@/lib/payments/audit";

// bussinesstemplate.md Phase E.5 · the gateway return routes
//
//   /api/payments/return/success
//   /api/payments/return/fail
//   /api/payments/return/cancel
//
// ── D14: THIS ROUTE MAY NOT DECIDE ANYTHING ─────────────────────────────────
// The whole point of E.5 is what it does NOT do. SSLCommerz sends the guest's
// own browser here, which means the request is attacker-controllable in the
// most literal sense available: anyone can type this URL. A guest who has
// paid nothing can reach /return/success with any tran_id they like. So this
// route writes no payment state, touches no booking, and calls no RPC. It
// records that a browser came back (an audit row, whose event types E.1
// already reserved) and points at the one endpoint that reads the truth:
// GET /api/payments/[tranId]/status, which reads the intent the IPN wrote.
//
// ── WHY ONE ROUTE WITH A [result] SEGMENT, NOT THREE FILES ──────────────────
// The three outcomes differ by one word of copy and one audit event name.
// Three files would be three copies of the same 90 lines, and the failure
// mode of that shape is the one this codebase has already been bitten by
// (B.6's "change one, change all three"): a fix applied to success/ and not
// to cancel/. The segment is validated against a closed set below, so
// /return/anything-else is a 404 rather than an unlabelled fourth outcome.
//
// ── GET *AND* POST ──────────────────────────────────────────────────────────
// SSLCommerz's docs describe success_url/fail_url/cancel_url as redirect
// targets, but the gateway actually returns the browser by POSTing a form to
// them (this is well documented in their sample integrations and is why every
// PHP sample reads $_POST here). A GET-only handler would 405 real guests
// while working perfectly in every test we could run by hand. Both verbs,
// same handler.

const RESULTS = {
  success: {
    event: "RETURN_SUCCESS" as PaymentEventType,
    title: "Confirming your payment…",
    body: "Your payment went through. We're waiting for the gateway to confirm it — this usually takes a few seconds. Your booking updates on its own.",
  },
  fail: {
    event: "RETURN_FAIL" as PaymentEventType,
    title: "That payment didn't go through",
    body: "Nothing was charged. You can try again from your booking.",
  },
  cancel: {
    event: "RETURN_CANCEL" as PaymentEventType,
    title: "Payment cancelled",
    body: "Nothing was charged. Your booking is still held for a short while if you'd like to try again.",
  },
} as const;

type ResultKey = keyof typeof RESULTS;

function isResultKey(v: string): v is ResultKey {
  return v === "success" || v === "fail" || v === "cancel";
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

// A plain, self-contained page. Deliberately not a Next.js page component:
// there is no web booking surface yet (Phase H) and E.9's Flutter WebView
// detects the return by URL and closes, so this is read by a human only in
// the browser fallback path. It states the truth (nothing is confirmed until
// the status endpoint says so) and offers no action that could imply
// otherwise.
function page(result: ResultKey, tranId: string): string {
  const copy = RESULTS[result];
  const statusUrl = tranId ? `/api/payments/${encodeURIComponent(tranId)}/status` : "";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="tripotter-payment-return" content="${escapeHtml(result)}">
<meta name="tripotter-tran-id" content="${escapeHtml(tranId)}">
<title>${escapeHtml(copy.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#0d0f12; color:#f2f4f7; padding:24px; }
  @media (prefers-color-scheme: light) { body { background:#f7f8fa; color:#14161a; } }
  main { max-width:26rem; text-align:center; }
  h1 { font-size:1.25rem; font-weight:600; margin:0 0 .6rem; }
  p { margin:0 0 1rem; opacity:.75; }
  code { font-size:.8rem; opacity:.5; }
</style></head>
<body><main>
  <h1>${escapeHtml(copy.title)}</h1>
  <p>${escapeHtml(copy.body)}</p>
  ${tranId ? `<p><code>${escapeHtml(tranId)}</code></p>` : ""}
  ${statusUrl ? `<p><code>Status: ${escapeHtml(statusUrl)}</code></p>` : ""}
</main></body></html>`;
}

async function handle(request: NextRequest, result: string): Promise<Response> {
  if (!isResultKey(result)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // tran_id arrives on the query string (we put it there ourselves at init)
  // and/or in the POSTed form. Read both; prefer whichever is present.
  let tranId = (request.nextUrl.searchParams.get("tran_id") ?? "").trim();
  let payload: Record<string, string> | null = null;
  if (request.method === "POST") {
    try {
      const form = await request.formData();
      payload = {};
      for (const [k, v] of form.entries()) {
        if (typeof v === "string") payload[k] = v.length > 4000 ? v.slice(0, 4000) : v;
      }
      const posted = (payload.tran_id ?? "").trim();
      if (posted) tranId = posted;
    } catch {
      // No body, or not form-encoded. The query string still carries the id.
    }
  }

  // Sanity-bound before it reaches a query or a page. 30 chars is the
  // database's own tran_id cap, so anything longer cannot be one of ours.
  if (tranId.length > 30 || !/^[A-Za-z0-9_-]*$/.test(tranId)) tranId = "";

  const html = page(result, tranId);
  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Never cached: the copy is about a specific transaction, and a shared
      // cache serving one guest's return page to another would be a leak of
      // their transaction id.
      "cache-control": "no-store",
    },
  });

  // Audit only. Rate-limited so a bored visitor refreshing this URL cannot
  // write unbounded rows, and skipped entirely without a tran_id — a bare
  // /return/success with nothing to key on is not an event worth recording.
  if (!tranId) return response;
  if (!(await isAllowed(`payments_return:${tranId}`, 20, 300))) return response;

  const db = createAdminClient();
  const { data: intent } = await db
    .from("payment_intents")
    .select("id")
    .eq("tran_id", tranId)
    .maybeSingle();

  await logPaymentEvent({
    paymentIntentId: intent?.id ?? null,
    tranId,
    eventType: RESULTS[result].event,
    payload,
    note: "Browser returned from gateway — UX only, no payment state written (D14)",
  });

  return response;
}

export const GET = timeRoute(
  "payments.return",
  async (request: NextRequest, ctx: { params: Promise<{ result: string }> }) =>
    handle(request, (await ctx.params).result)
);

export const POST = timeRoute(
  "payments.return",
  async (request: NextRequest, ctx: { params: Promise<{ result: string }> }) =>
    handle(request, (await ctx.params).result)
);
