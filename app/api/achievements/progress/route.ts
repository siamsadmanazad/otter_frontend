import { NextRequest } from "next/server";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/achievements/progress -> live counters behind every measurable rung.
//
// docs/achievement_tree.md Phase 1 ("progress everywhere"). The roadmap used to
// render a padlock next to "Write 10 Journals" with no way of knowing you had
// written seven; this is the number that turns a tease into a plan.
//
// Actor client, not admin: achievement_progress() takes NO arguments and reads
// current_profile_id() from the JWT. That is deliberate and not negotiable --
// a SECURITY DEFINER function that takes the identity it acts on as an
// argument is finding F16's exact hole shape, which let anon mint the whole
// distance badge ladder into any account. An admin client here would mean
// passing a uid, so the client carries the caller's JWT instead.
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);

  try {
    const db = await createActorClient(request);
    const { data, error } = await db.rpc("achievement_progress");
    if (error) return fail(error.message, 500);

    const row = (data ?? {}) as Record<string, unknown>;
    const { role, ...metrics } = row;

    // Counters only -- the thresholds live in achievement_roadmap.dart so that
    // "10 journals" has exactly one definition (decision D1). This route must
    // never start deciding what "done" means.
    return ok(
      {
        role: typeof role === "string" ? role : "explorer",
        metrics: Object.fromEntries(
          Object.entries(metrics).map(([k, v]) => [k, Number(v ?? 0)])
        ),
      },
      "Achievement progress"
    );
  } catch (e) {
    console.error("GET /api/achievements/progress error:", e);
    return fail("Internal server error", 500);
  }
}
