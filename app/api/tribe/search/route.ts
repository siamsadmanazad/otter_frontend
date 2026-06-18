import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ok, fail, mapTribe } from "@/lib/api/http";

export interface IPayloadProps {
  privacy?: string;
  category?: string | null;
  tags?: string[];
}

const TRIBE_COLS =
  "id, serial, name, description, category, tags, cover_image, profile_image, created_by, privacy, created_at, updated_at";

async function searchTribes(searchText: string | null, payload: IPayloadProps) {
  const db = createAdminClient();
  let q = db.from("tribes").select(TRIBE_COLS).order("created_at", { ascending: false }).limit(50);

  if (searchText && searchText.trim()) q = q.ilike("name", `%${searchText}%`);
  if (payload.privacy) q = q.eq("privacy", payload.privacy);
  if (payload.category && payload.category !== "NONE" && payload.category !== "") {
    q = q.eq("category", payload.category);
  }
  if (payload.tags && payload.tags.length > 0) q = q.overlaps("tags", payload.tags);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapTribe);
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
