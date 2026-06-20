import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// DELETE /api/chat/messages/[id] -> soft-delete the caller's own message.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const { id } = await params;
  const db = createAdminClient();

  const { data, error } = await db
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", me.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("Message not found or not yours", 404);
  return ok({ id }, "Message deleted");
}
