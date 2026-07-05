import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/wallet/transfer  body { toUserId, amountMinor, note? } -> atomic P2P send.
// The RPC enforces: positive amount, not self, recipient exists, no block either way,
// sufficient balance, and writes the paired DEBIT/CREDIT ledger rows atomically.
export async function POST(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const toUserId: string | undefined = body.toUserId;
  const amountMinor = Number(body.amountMinor);
  if (!toUserId) return fail("toUserId is required", 400);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0)
    return fail("amountMinor must be a positive integer", 400);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("wallet_transfer", {
    p_to: toUserId,
    p_amount_minor: Math.round(amountMinor),
    p_note: body.note ?? null,
  });
  if (error) return fail(error.message, 400);

  return ok({ balanceMinor: Number(data) }, "Sent");
}
