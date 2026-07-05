import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

function mapTxn(t: Record<string, any>) {
  return {
    id: t.id,
    direction: t.direction, // CREDIT | DEBIT
    amountMinor: Number(t.amount_minor),
    kind: t.kind, // topup | transfer_in | transfer_out | purchase | refund | adjustment
    counterpartyId: t.counterparty_id,
    reference: t.reference,
    note: t.note,
    balanceAfter: Number(t.balance_after),
    createdAt: t.created_at,
  };
}

// GET /api/wallet/ledger?limit=30&before=<iso> -> paginated transaction history.
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const sp = request.nextUrl.searchParams;
  const limit = Number(sp.get("limit") ?? 30);
  const before = sp.get("before"); // ISO cursor (created_at), optional

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("wallet_ledger", {
    p_limit: Number.isFinite(limit) ? limit : 30,
    p_before: before || null,
  });
  if (error) return fail(error.message, 500);

  return ok((data ?? []).map(mapTxn), "Ledger fetched");
}
