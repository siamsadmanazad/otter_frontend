import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// POST /api/wallet/topup  body { amountMinor, note? } -> mock credit (v1, no PSP).
// The RPC guards amount > 0 and a sanity cap; returns the new balance.
export async function POST(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const amountMinor = Number(body.amountMinor);
  if (!Number.isFinite(amountMinor) || amountMinor <= 0)
    return fail("amountMinor must be a positive integer", 400);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("wallet_topup", {
    p_amount_minor: Math.round(amountMinor),
    p_note: body.note ?? null,
  });
  if (error) return fail(error.message, 400);

  return ok({ balanceMinor: Number(data) }, "Topped up");
}
