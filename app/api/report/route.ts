import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/report (own reports) or ?id=<reportId>
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const id = request.nextUrl.searchParams.get("id");
  const db = createAdminClient();
  if (id) {
    const { data } = await db.from("reports").select("*").eq("id", id).maybeSingle();
    return ok(data, "Report fetched");
  }
  const { data } = await db
    .from("reports")
    .select("*")
    .eq("reported_by", user.id)
    .order("created_at", { ascending: false });
  return ok(data ?? [], "Report fetched");
}

// POST /api/report  body { data: { reportedUser, scope, reason, reasonDescription?, relatedComment?, relatedPost? } }
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const payload = await request.json();
    const d = payload.data ?? payload;
    const db = createAdminClient();
    const { data, error } = await db
      .from("reports")
      .insert({
        reported_by: user.id,
        reported_user: d.reportedUser ?? null,
        scope: d.scope,
        reason: d.reason,
        reason_description: d.reasonDescription ?? null,
        related_comment: d.relatedComment ?? null,
        related_post: d.relatedPost ?? null,
        status: "PENDING",
      })
      .select("*")
      .single();
    if (error) return fail(error.message, 500);
    return ok(data, "Report created");
  } catch (e) {
    console.error("POST /api/report error:", e);
    return fail("Internal server error", 500);
  }
}

// PATCH /api/report  body { id, status }
export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const { id, status } = await request.json();
    if (!id || !status) return fail("id and status are required", 400);
    const db = createAdminClient();
    const { data, error } = await db
      .from("reports")
      .update({ status })
      .eq("id", id)
      .eq("reported_by", user.id)
      .select("*")
      .single();
    if (error || !data) return fail("Report not found", 404);
    return ok(data, "Report updated");
  } catch (e) {
    console.error("PATCH /api/report error:", e);
    return fail("Internal server error", 500);
  }
}

// DELETE /api/report?id=<reportId>
export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return fail("Report ID is required", 400);
  const db = createAdminClient();
  const { data, error } = await db
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("reported_by", user.id)
    .select("id")
    .single();
  if (error || !data) return fail("Report not found", 404);
  return ok({ id }, "Report deleted");
}
