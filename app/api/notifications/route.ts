import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

export function mapNotification(n: Record<string, any> | null) {
  if (!n) return null;
  return {
    id: n.id,
    type: n.type,
    targetType: n.target_type,
    targetId: n.target_id,
    message: n.message,
    read: n.read,
    createdAt: n.created_at,
    readAt: n.read_at,
    actor: n.actor
      ? {
          id: n.actor.id,
          username: n.actor.username,
          fullName: n.actor.full_name,
          profileImage: n.actor.profile_image,
        }
      : undefined,
  };
}

const ACTOR = "actor:profiles!notifications_actor_id_fkey(id, username, full_name, profile_image)";

// GET /api/notifications -> current user's notifications (newest first)
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const db = createAdminClient();
  const { data, error } = await db
    .from("notifications")
    .select(`id, type, target_type, target_id, message, read, created_at, read_at, ${ACTOR}`)
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail(error.message, 500);
  return ok((data ?? []).map(mapNotification), "Notifications fetched");
}

// PATCH /api/notifications  body { id }  -> mark one read;  body { all: true } -> mark all read
export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const db = createAdminClient();
  const now = new Date().toISOString();

  if (body.all) {
    await db
      .from("notifications")
      .update({ read: true, read_at: now })
      .eq("recipient_id", user.id)
      .eq("read", false);
    return ok({ all: true }, "All notifications marked read");
  }
  if (!body.id) return fail("Notification id is required", 400);
  const { data, error } = await db
    .from("notifications")
    .update({ read: true, read_at: now })
    .eq("id", body.id)
    .eq("recipient_id", user.id)
    .select("id")
    .single();
  if (error || !data) return fail("Notification not found", 404);
  return ok({ id: body.id }, "Notification marked read");
}
