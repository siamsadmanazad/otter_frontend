import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/radar/quests/start  body: { questId }
// Begin tracking a quest via radar_quest_start (Otter Radar Phase 6.2).
// Idempotent — returns { status: 'started' | 'already_started' | 'already_completed' }.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  try {
    const body = await request.json();
    const questId = typeof body?.questId === "string" ? body.questId : "";
    if (!UUID_RE.test(questId)) return fail("Invalid quest", 400);

    const supabase = await createActorClient(request);
    const { data, error } = await supabase.rpc("radar_quest_start", {
      p_quest_id: questId,
    });
    if (error) {
      if (/not found/i.test(error.message || "")) return fail("Quest not found", 404);
      return fail(error.message, 500);
    }
    return ok(data, "Quest started");
  } catch (e) {
    console.error("POST /api/radar/quests/start error:", e);
    return fail("Failed starting quest", 500);
  }
}
