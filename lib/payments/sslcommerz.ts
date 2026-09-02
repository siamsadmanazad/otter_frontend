// TripOtter · bussinesstemplate.md Phase E · the SSLCommerz seam
//
// Every conversation with the gateway happens through this file: the init
// call (E.3), the validator API (E.4 -- the only thing that may confirm a
// payment, D14/S4), and the transaction query (E.6's reconciliation). Three
// routes talk to one provider, so the provider's quirks are stated once.
//
// ── S7: WHAT MAY NEVER LEAVE THIS FILE ──────────────────────────────────────
// SSLCZ_STORE_PASSWD is read here and nowhere else. It is never returned to a
// caller, never logged, and -- the part that is easy to get wrong --
// `redactForAudit()` below strips it before a request body is persisted to
// payment_intents.request_payload, because "we stored the whole request for
// audit" is exactly how a merchant password ends up sitting in a database
// forever.
//
// ── D12/S8: WHERE DECIMALS ARE ALLOWED TO EXIST ─────────────────────────────
// Exactly one place: the wire. SSLCommerz speaks decimal strings ("500.00");
// TripOtter speaks integer poisha (50000). minorToDecimalString() and
// decimalStringToMinor() are that boundary, and they do string arithmetic
// rather than dividing by 100, because `1999 / 100` is not exactly 19.99 in a
// float and money comparisons must be exact. Nothing else in this codebase
// should ever hold a decimal amount.

export interface SslcommerzConfig {
  storeId: string;
  storePasswd: string;
  isLive: boolean;
  /** Scheme + host, no trailing slash. */
  host: string;
  /** APP_PUBLIC_URL, no trailing slash. */
  appUrl: string;
  ipnPath: string;
}

const SANDBOX_HOST = "https://sandbox.sslcommerz.com";
const LIVE_HOST = "https://securepay.sslcommerz.com";

/**
 * Returns null when the gateway is not configured on this environment rather
 * than throwing at module load. A missing SSLCommerz config must degrade to
 * "payments unavailable" on one route, never to a boot failure that takes the
 * whole API down — the same posture `lib/supabase/admin.ts` deliberately does
 * NOT take, and the difference is that Supabase is load-bearing for every
 * route while this is load-bearing for four.
 */
export function sslcommerzConfig(): SslcommerzConfig | null {
  const storeId = process.env.SSLCZ_STORE_ID;
  const storePasswd = process.env.SSLCZ_STORE_PASSWD;
  const appUrl = process.env.APP_PUBLIC_URL;
  if (!storeId || !storePasswd || !appUrl) return null;

  const isLive = String(process.env.SSLCZ_IS_LIVE ?? "").toLowerCase() === "true";
  return {
    storeId,
    storePasswd,
    isLive,
    host: isLive ? LIVE_HOST : SANDBOX_HOST,
    appUrl: appUrl.replace(/\/+$/, ""),
    ipnPath: process.env.SSLCZ_IPN_PATH || "/api/payments/ipn",
  };
}

// ── The minor-unit boundary ─────────────────────────────────────────────────

/** 50000 -> "500.00". Exact integer arithmetic; never divides by 100. */
export function minorToDecimalString(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${negative ? "-" : ""}${whole}.${String(frac).padStart(2, "0")}`;
}

/**
 * "500.00" -> 50000, or null if the string is not a plain non-negative decimal
 * amount with at most two fractional digits.
 *
 * Deliberately NOT parseFloat: `parseFloat("500.00abc")` is 500, `parseFloat("")`
 * is NaN but `parseFloat(" 5e2")` is 500, and every one of those leniencies is
 * a way for a forged IPN body to be read as an amount it does not say. A
 * strict regex plus integer arithmetic has no such surface. Returning null
 * (rather than 0) means a caller cannot accidentally treat an unparseable
 * amount as a free booking.
 */
export function decimalStringToMinor(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  const m = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = Number((m[2] ?? "").padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(whole)) return null;
  return whole * 100 + frac;
}

// ── tran_id ─────────────────────────────────────────────────────────────────

/**
 * <= 30 chars, [A-Za-z0-9_-] only — both limits are the database's
 * payment_intents_tran_id_chk, which in turn is SSLCommerz's own 30-character
 * cap (a longer id comes back truncated and matches no intent, which is a
 * silent failure).
 *
 * Shape: TO + the booking code without its punctuation + a base36 timestamp +
 * 4 random chars. "TO" + 6 + 8 + 4 = 20. The booking code is in there so a
 * human reading a gateway statement can find the booking without a lookup;
 * the timestamp+random tail is what makes a RETRY after a failed or abandoned
 * checkout a genuinely new transaction id rather than a collision with the
 * one the gateway has already seen.
 */
export function buildTranId(bookingCode: string): string {
  const code = bookingCode
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
  return `TO${code}${stamp}${rand}`.slice(0, 30);
}

// ── Audit redaction (S7) ────────────────────────────────────────────────────

const SECRET_FIELDS = new Set(["store_passwd", "storePasswd", "store_password"]);

/**
 * A copy of an outbound request body safe to persist. The merchant password
 * is replaced, not deleted, so an auditor can see that it WAS sent (and to
 * which store) without it being readable — deleting it would make a request
 * that failed authentication indistinguishable from one that never carried
 * credentials at all.
 */
export function redactForAudit(payload: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    out[k] = SECRET_FIELDS.has(k) ? "[redacted]" : v;
  }
  return out;
}

// ── 1. Initiate (E.3) ───────────────────────────────────────────────────────

export interface SslcommerzInitResult {
  ok: boolean;
  gatewayPageUrl: string | null;
  /** SSLCommerz's own words, for payment_events.note. Never returned to a client. */
  reason: string | null;
  raw: Record<string, unknown>;
}

export async function sslcommerzInit(
  cfg: SslcommerzConfig,
  fields: Record<string, string>
): Promise<SslcommerzInitResult> {
  const body = new URLSearchParams({
    store_id: cfg.storeId,
    store_passwd: cfg.storePasswd,
    ...fields,
  });

  const res = await fetch(`${cfg.host}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    // A gateway that has not answered in 20s is not going to; the guest is
    // staring at a spinner and would rather be told to try again.
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // SSLCommerz answers with an HTML error page on some failures. Keep a
    // bounded slice for the audit row — never the whole page, which can be
    // hundreds of KB into a jsonb column.
    return {
      ok: false,
      gatewayPageUrl: null,
      reason: `Non-JSON response (HTTP ${res.status})`,
      raw: { httpStatus: res.status, body: text.slice(0, 2000) },
    };
  }

  const status = typeof raw.status === "string" ? raw.status : "";
  const url = typeof raw.GatewayPageURL === "string" ? raw.GatewayPageURL : "";
  const failedReason = typeof raw.failedreason === "string" ? raw.failedreason : null;

  if (status.toUpperCase() !== "SUCCESS" || !url) {
    return {
      ok: false,
      gatewayPageUrl: null,
      reason: failedReason || `Gateway returned status=${status || "(none)"}`,
      raw,
    };
  }
  return { ok: true, gatewayPageUrl: url, reason: null, raw };
}

// ── 2. Order validation by val_id (E.4 — THE authority, D14/S4) ─────────────

export interface SslcommerzValidation {
  status: string;
  tranId: string;
  valId: string;
  amount: string;
  storeAmount: string;
  currency: string;
  bankTranId: string;
  riskLevel: string;
  riskTitle: string;
  apiConnect: string;
  raw: Record<string, unknown>;
}

export async function sslcommerzValidate(
  cfg: SslcommerzConfig,
  valId: string
): Promise<SslcommerzValidation> {
  const qs = new URLSearchParams({
    val_id: valId,
    store_id: cfg.storeId,
    store_passwd: cfg.storePasswd,
    format: "json",
  });
  const res = await fetch(`${cfg.host}/validator/api/validationserverAPI.php?${qs}`, {
    method: "GET",
    signal: AbortSignal.timeout(20_000),
  });
  const raw = (await res.json()) as Record<string, unknown>;
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  return {
    status: str("status"),
    tranId: str("tran_id"),
    valId: str("val_id"),
    amount: str("amount"),
    storeAmount: str("store_amount"),
    currency: str("currency"),
    bankTranId: str("bank_tran_id"),
    riskLevel: str("risk_level"),
    riskTitle: str("risk_title"),
    apiConnect: str("APIConnect"),
    raw,
  };
}

// ── 3. Transaction query by tran_id (E.6 — the ONLY way to recover a
//      payment that never produced an IPN) ────────────────────────────────────
//
// ⚠️ This endpoint is not the one E.6's text assumes. E.6 says "re-queried
// against the validator API", but validationserverAPI.php takes a `val_id`,
// and a val_id only ever reaches us INSIDE an IPN. An intent stuck PENDING is
// by definition one for which no IPN arrived, so there is no val_id to
// re-query with, and E.6 as literally written cannot cover R-6 ("dropped IPN
// leaves money taken and no booking") — the exact case it exists for.
//
// merchantTransIDvalidationAPI.php closes that gap: it takes the `tran_id` WE
// generated, which we always have. Verified live against the sandbox with the
// testbox credentials: an unknown tran_id answers
//   {"APIConnect":"DONE","no_of_trans_found":0,
//    "element":[{"tran_id":"…","status":"INVALID"}]}
// so "no such transaction" is distinguishable from "the API is down"
// (APIConnect != DONE) — which matters, because those two must lead to
// opposite decisions: expire the intent, or leave it alone and try later.
export interface SslcommerzTranQueryElement {
  status: string;
  tranId: string;
  valId: string;
  amount: string;
  currency: string;
  bankTranId: string;
  raw: Record<string, unknown>;
}

export interface SslcommerzTranQuery {
  apiConnect: string;
  count: number;
  elements: SslcommerzTranQueryElement[];
  raw: Record<string, unknown>;
}

export async function sslcommerzQueryByTranId(
  cfg: SslcommerzConfig,
  tranId: string
): Promise<SslcommerzTranQuery> {
  const qs = new URLSearchParams({
    tran_id: tranId,
    store_id: cfg.storeId,
    store_passwd: cfg.storePasswd,
    format: "json",
  });
  const res = await fetch(`${cfg.host}/validator/api/merchantTransIDvalidationAPI.php?${qs}`, {
    method: "GET",
    signal: AbortSignal.timeout(20_000),
  });
  const raw = (await res.json()) as Record<string, unknown>;
  const list = Array.isArray(raw.element) ? (raw.element as Record<string, unknown>[]) : [];
  const str = (o: Record<string, unknown>, k: string) =>
    typeof o[k] === "string" ? (o[k] as string) : "";
  return {
    apiConnect: typeof raw.APIConnect === "string" ? raw.APIConnect : "",
    count: Number(raw.no_of_trans_found ?? list.length) || 0,
    elements: list.map((e) => ({
      status: str(e, "status"),
      tranId: str(e, "tran_id"),
      valId: str(e, "val_id"),
      amount: str(e, "amount"),
      currency: str(e, "currency"),
      bankTranId: str(e, "bank_tran_id"),
      raw: e,
    })),
    raw,
  };
}

/** VALID and VALIDATED both mean paid — E.1's enum collapses them to VALID. */
export function isPaidStatus(status: string): boolean {
  const s = status.trim().toUpperCase();
  return s === "VALID" || s === "VALIDATED";
}

/**
 * The gateway still has this transaction in flight — the guest is on the
 * payment page, or their bank has not answered yet.
 *
 * Observed, not documented: a session created by a successful init and never
 * paid reports `status: "PROCESSING"` from merchantTransIDvalidationAPI, with
 * `no_of_trans_found: 1`. That matters because "the gateway knows about this
 * transaction" and "the transaction is finished" are different questions, and
 * conflating them is what lets a forged IPN close a live checkout (see the
 * long note in app/api/payments/ipn/route.ts).
 */
export function isInFlightStatus(status: string): boolean {
  const s = status.trim().toUpperCase();
  return s === "PROCESSING" || s === "PENDING" || s === "" || s === "UNATTEMPTED";
}
