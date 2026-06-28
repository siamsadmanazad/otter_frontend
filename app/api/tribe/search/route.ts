import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, mapTribe } from "@/lib/api/http";

export interface IPayloadProps {
  privacy?: string;
  category?: string | null;
  tags?: string[];
}

const TRIBE_COLS =
  "id, serial, name, description, category, tags, cover_image, profile_image, created_by, privacy, rules, destination, trip_start, trip_end, member_count, post_count, created_at, updated_at";

async function searchTribes(searchText: string | null, payload: IPayloadProps) {
  const db = createAdminClient();
  // Most popular first so a bare query surfaces the liveliest communities.
  let q = db.from("tribes").select(TRIBE_COLS).order("member_count", { ascending: false }).limit(50);

  const term = searchText?.trim();
  if (term) {
    // Match name, description, or travel destination. Strip characters that
    // would break PostgREST's or() filter grammar before interpolating.
    const safe = term.replace(/[,()*]/g, " ").trim();
    if (safe) {
      q = q.or(
        `name.ilike.%${safe}%,description.ilike.%${safe}%,destination.ilike.%${safe}%`
      );
    }
  }

  // Discovery search only exposes PUBLIC tribes unless a privacy filter is set.
  q = q.eq("privacy", payload.privacy ?? "PUBLIC");
  if (payload.category && payload.category !== "NONE" && payload.category !== "") {
    q = q.eq("category", payload.category);
  }
  if (payload.tags && payload.tags.length > 0) q = q.overlaps("tags", payload.tags);

  const { data, error } = await q;
  if (error) throw error;

  const tribes = (data ?? []).map(mapTribe);
  // Lightweight relevance: name matches rank above description/destination ones.
  if (term) {
    const t = term.toLowerCase();
    tribes.sort((a, b) => {
      const an = (a?.name ?? "").toLowerCase().includes(t) ? 0 : 1;
      const bn = (b?.name ?? "").toLowerCase().includes(t) ? 0 : 1;
      return an - bn;
    });
  }
  return tribes;
}

// POST /api/tribe/search?searchText=  body { privacy?, category?, tags? }
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const searchText = request.nextUrl.searchParams.get("searchText");
    const payload = (await request.json().catch(() => ({}))) as IPayloadProps;
    const tribes = await searchTribes(searchText, payload);
    return ok(tribes, "get searched tribes");
  } catch (e) {
    console.error("POST /api/tribe/search error:", e);
    return fail("Internal server error", 500);
  }
}

// GET /api/tribe/search?searchText=  (no filter body)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchText = request.nextUrl.searchParams.get("searchText");
    const tribes = await searchTribes(searchText, {});
    return ok(tribes, "get searched tribes");
  } catch (e) {
    console.error("GET /api/tribe/search error:", e);
    return fail("Internal server error", 500);
  }
}
