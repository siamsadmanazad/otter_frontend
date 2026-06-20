import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/review?id= | ?page=&limit=
export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const id = sp.get("id") ?? "";
  const db = createAdminClient();
  if (id) {
    const { data } = await db.from("reviews").select("*").eq("id", id).maybeSingle();
    return ok(data, "Received data");
  }
  const page = parseInt(sp.get("page") ?? "1", 10);
  const limit = parseInt(sp.get("limit") ?? "10", 10);
  const from = (page - 1) * limit;
  const { data } = await db
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  return ok(data ?? [], "Received data");
}

// POST /api/review  body { type, scope, review|title|description, media? }
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const b = await request.json();
    const db = createAdminClient();
    const { data, error } = await db
      .from("reviews")
      .insert({
        user_id: user.id,
        type: b.type === "BUG_REPORT" ? "BUG_REPORT" : "REVIEW",
        scope: b.scope ?? "USER_EXPERIENCE",
        review: b.review ?? null,
        title: b.title ?? null,
        description: b.description ?? null,
        media: b.media ?? [],
      })
      .select("*")
      .single();
    if (error) return fail(error.message, 500);
    return ok(data, b.type === "BUG_REPORT" ? "bug report submitted" : "review submitted");
  } catch (e) {
    console.error("POST /api/review error:", e);
    return fail("Internal server error", 500);
  }
}

// PATCH /api/review?id=  body { ...fields }
export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return fail("Review ID is required", 400);
    const b = await request.json();
    const allowed: Record<string, string> = {
      type: "type",
      scope: "scope",
      status: "status",
      review: "review",
      title: "title",
      description: "description",
      media: "media",
    };
    const update: Record<string, unknown> = {};
    for (const [k, col] of Object.entries(allowed)) if (k in b) update[col] = b[k];
    const db = createAdminClient();
    const { data, error } = await db
      .from("reviews")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error || !data) return fail("Review not found", 404);
    return ok(data, "Review updated");
  } catch (e) {
    console.error("PATCH /api/review error:", e);
    return fail("Internal server error", 500);
  }
}

// DELETE /api/review?id=
export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return fail("Review ID is required", 400);
  const db = createAdminClient();
  const { data, error } = await db
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();
  if (error || !data) return fail("Review not found", 404);
  return ok({ id }, "Review deleted");
}
