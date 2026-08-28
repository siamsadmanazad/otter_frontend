import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/activities/progression -> the caller's Otter Trails XP/level
// (gamify.md §31, Phase 4). Deliberately a separate number from OttiCash
// (/api/wallet) -- decision D3, XP is progression, not currency.
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data, error } = await db.rpc("my_progression");
  if (error) return fail(error.message, 500);

  return ok(data, "Progression fetched");
}
