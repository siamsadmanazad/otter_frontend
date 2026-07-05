import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/wallet -> the caller's OttiCash balance.
// Actor client carries the caller's JWT so wallet_balance()'s auth.uid() resolves
// (and lazily creates the account row on first read).
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("wallet_balance");
  if (error) return fail(error.message, 500);

  const row = Array.isArray(data) ? data[0] : data;
  return ok(
    {
      balanceMinor: Number(row?.balance_minor ?? 0),
      currency: row?.currency ?? "BDT",
      status: row?.status ?? "active",
    },
    "Balance fetched"
  );
}
