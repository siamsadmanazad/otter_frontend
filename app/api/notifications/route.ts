import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

function mapNotification(n: Record<string, any> | null) {
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

// Category filter -> the notification types it covers.
const FILTER_TYPES: Record<string, string[]> = {
  follows: ["FOLLOW"],
  likes: ["LIKE"],
  comments: ["COMMENT"],
  mentions: ["MENTION"],
  tribes: ["TRIBE_JOIN", "TRIBE_POST"],
  trips: ["TRIP_REQUEST", "TRIP_ACCEPTED"],
};

// GET /api/notifications?page=&limit=&filter=&unread= -> current user's notifications
//   filter: all | follows | likes | comments | mentions | tribes | trips
//   unread: "true" -> only unread rows
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "30", 10)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const filter = (sp.get("filter") || "all").toLowerCase();
  const unread = sp.get("unread") === "true";
  const db = createAdminClient();
  let query = db
    .from("notifications")
    .select(`id, type, target_type, target_id, message, read, created_at, read_at, ${ACTOR}`)
    .eq("recipient_id", user.id);
  if (FILTER_TYPES[filter]) query = query.in("type", FILTER_TYPES[filter]);
  if (unread) query = query.eq("read", false);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return fail(error.message, 500);
  return ok((data ?? []).map(mapNotification), "Notifications fetched");
}

// DELETE /api/notifications?id=   -> remove one of the caller's own notifications
//        /api/notifications?all=true -> clear all of the caller's notifications
export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const sp = request.nextUrl.searchParams;
  const db = createAdminClient();
  if (sp.get("all") === "true") {
    const { error } = await db
      .from("notifications")
      .delete()
      .eq("recipient_id", user.id);
    if (error) return fail(error.message, 500);
    return ok({ all: true }, "All notifications cleared");
  }
  const id = sp.get("id");
  if (!id) return fail("Notification id is required", 400);
  const { error } = await db
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("recipient_id", user.id);
  if (error) return fail(error.message, 500);
  return ok({ id }, "Notification deleted");
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
