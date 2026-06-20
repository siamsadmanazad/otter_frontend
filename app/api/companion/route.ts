import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";

const intakeSchema = z.object({
  destination: z.string().trim().max(120).optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  interests: z.array(z.string().trim().max(40)).max(20).optional(),
  budget: z.string().trim().max(40).optional(),
  travelStyle: z.string().trim().max(40).optional(),
});

// GET /api/companion?userId=&page=&limit= -> suggested users (people you don't already follow)
// Returns the legacy nested shape { _id, id, user: { _id, id, ... } } so existing cards work.
export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const userId = sp.get("userId");
  const page = parseInt(sp.get("page") || "1", 10);
  const limit = parseInt(sp.get("limit") || "10", 10);
  const from = (page - 1) * limit;
  if (!userId) return fail("userId is required", 400);

  try {
    const db = createAdminClient();
    // ids the user already follows
    const { data: followRows } = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);
    const exclude = [userId, ...((followRows ?? []) as { following_id: string }[]).map((r) => r.following_id)];

    const { data, error } = await db
      .from("profiles")
      .select("id, full_name, username, bio, location, role, profile_image, created_at, updated_at")
      .not("id", "in", `(${exclude.join(",")})`)
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);
    if (error) return fail(error.message, 500);

    const suggested = ((data ?? []) as any[]).map((p) => ({
      _id: p.id,
      id: p.id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      user: {
        _id: p.id,
        id: p.id,
        fullName: p.full_name,
        username: p.username,
        bio: p.bio,
        location: p.location,
        role: p.role,
        profileImage: p.profile_image,
      },
    }));
    return ok(suggested, "Suggested companions");
  } catch (e) {
    console.error("GET /api/companion error:", e);
    return fail("Internal server error", 500);
  }
}

// POST /api/companion -> persist a travel-companion request + return heuristic-ranked
// matches (shared destination/interests, excluding people you already follow).
// AI (Gemini) ranking is a drop-in upgrade later (gap G14); the shape stays the same.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  // Matching is relatively expensive — cap at 20 requests / day per user.
  const limited = await enforceRateLimit("companion", user.id, request, 20, 86400);
  if (limited) return limited;

  const parsed = intakeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message || "Invalid request", 400);
  const intake = parsed.data;

  try {
    const db = createAdminClient();

    // Exclude self + people already followed.
    const { data: followRows } = await db
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);
    const exclude = [
      user.id,
      ...((followRows ?? []) as { following_id: string }[]).map((r) => r.following_id),
    ];

    // Candidate pool (cap for a cheap heuristic pass).
    const { data: candidates } = await db
      .from("profiles")
      .select("id, full_name, username, bio, location, role, profile_image")
      .not("id", "in", `(${exclude.join(",")})`)
      .limit(100);

    const dest = (intake.destination ?? "").toLowerCase();
    const interests = (intake.interests ?? []).map((s) => s.toLowerCase());
    const ranked = ((candidates ?? []) as any[])
      .map((p) => {
        let score = 0;
        const reasons: string[] = [];
        const loc = (p.location ?? "").toLowerCase();
        const bio = (p.bio ?? "").toLowerCase();
        if (dest && loc && (loc.includes(dest) || dest.includes(loc))) {
          score += 3;
          reasons.push("near your destination");
        }
        for (const it of interests) {
          if (it && (bio.includes(it) || loc.includes(it))) {
            score += 1;
            reasons.push(`shares interest in ${it}`);
          }
        }
        return { p, score, reason: reasons.join(", ") || "open to new travel buddies" };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Persist the request with its computed matches.
    const matches = ranked.map((r) => ({
      userId: r.p.id,
      score: r.score,
      reason: r.reason,
    }));
    await db.from("companion_requests").insert({
      user_id: user.id,
      destination: intake.destination ?? null,
      date_start: intake.dateStart ?? null,
      date_end: intake.dateEnd ?? null,
      interests: intake.interests ?? [],
      budget: intake.budget ?? null,
      travel_style: intake.travelStyle ?? null,
      matches,
    });

    const result = ranked.map((r) => ({
      id: r.p.id,
      score: r.score,
      reason: r.reason,
      user: {
        id: r.p.id,
        fullName: r.p.full_name,
        username: r.p.username,
        bio: r.p.bio,
        location: r.p.location,
        role: r.p.role,
        profileImage: r.p.profile_image,
      },
    }));
    return ok(result, "Companion matches");
  } catch (e) {
    console.error("POST /api/companion error:", e);
    return fail("Internal server error", 500);
  }
}
