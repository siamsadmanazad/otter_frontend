import { NextRequest } from "next/server";
import { z } from "zod";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const bodySchema = z.object({ featureKey: z.string().max(64) });

// POST /api/cosmetics/buy -> spend OttiCash on a catalogued cosmetic.
//
// The body carries ONLY the key. Price and duration come from
// `premium_products`, server-side — that is the whole shape of the fix for
// finding F14, where wallet_purchase() took the price from the caller and could
// therefore be called with a zero.
//
// Errors are surfaced by name rather than flattened into a 500: the client
// renders "Owned" and "Not enough OttiCash" differently, and a generic failure
// would make a double-tap look like an outage.
export async function POST(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("featureKey is required", 400);

  try {
    const db = await createActorClient(request);
    const { data, error } = await db.rpc("wallet_buy", {
      p_feature_key: parsed.data.featureKey,
    });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("ALREADY_OWNED")) return fail("You already own this.", 409);
      if (msg.includes("INSUFFICIENT_BALANCE")) return fail("Not enough OttiCash yet.", 402);
      if (msg.includes("PRODUCT_NOT_AVAILABLE")) return fail("That is not for sale.", 404);
      return fail(msg, 500);
    }
    return ok(data ?? {}, "Bought");
  } catch (e) {
    console.error("POST /api/cosmetics/buy error:", e);
    return fail("Internal server error", 500);
  }
}
