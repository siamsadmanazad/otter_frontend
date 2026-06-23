import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// DELETE /api/account -> permanently delete the authenticated user.
// profiles.id references auth.users ON DELETE CASCADE, and posts/comments/etc.
// cascade from profiles, so removing the auth user wipes all of their content.
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    const db = createAdminClient();
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) return fail(error.message, 500);

    return ok({ deleted: true }, "Account deleted");
  } catch (e) {
    console.error("DELETE /api/account error:", e);
    return fail("Internal server error", 500);
  }
}
