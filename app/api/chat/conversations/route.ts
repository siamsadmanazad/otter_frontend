import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { withDefaults } from "@/lib/preferences";

type Profile = {
  id: string;
  username: string;
  full_name: string;
  profile_image: string | null;
};

function mapUser(p: Profile | null) {
  if (!p) return null;
  return {
    id: p.id,
    username: p.username,
    fullName: p.full_name,
    profileImage: p.profile_image,
  };
}

// GET /api/chat/conversations -> the caller's conversations, newest activity first.
// Actor client: RLS (cp_select_participant / conversations_select_participant) scopes
// every read to the caller's own conversations.
export async function GET(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const db = await createActorClient(request);

  const { data: myRows } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", me.id);
  const convIds = (myRows ?? []).map((r: any) => r.conversation_id);
  if (convIds.length === 0) return ok([], "No conversations");

  const { data: convs, error } = await db
    .from("conversations")
    .select(
      "id, serial, type, name, cover_image, last_message_id, last_message_at, created_by, created_at"
    )
    .in("id", convIds)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) return fail(error.message, 500);

  // All participants (with profiles) for these conversations.
  const { data: parts } = await db
    .from("conversation_participants")
    .select(
      "conversation_id, user_id, profile:profiles!conversation_participants_user_id_fkey(id, username, full_name, profile_image)"
    )
    .in("conversation_id", convIds);
  const byConv = new Map<string, any[]>();
  for (const p of parts ?? []) {
    const arr = byConv.get(p.conversation_id) ?? [];
    arr.push(p);
    byConv.set(p.conversation_id, arr);
  }

  // Last messages + my read state on them.
  const lastIds = (convs ?? [])
    .map((c: any) => c.last_message_id)
    .filter(Boolean);
  const lastMsgById = new Map<string, any>();
  const readSet = new Set<string>();
  if (lastIds.length) {
    const { data: msgs } = await db
      .from("messages")
      .select("id, content, sender_id, created_at, deleted_at")
      .in("id", lastIds);
    for (const m of msgs ?? []) lastMsgById.set(m.id, m);
    const { data: reads } = await db
      .from("message_reads")
      .select("message_id")
      .eq("user_id", me.id)
      .in("message_id", lastIds);
    for (const r of reads ?? []) readSet.add(r.message_id);
  }

  const result = (convs ?? []).map((c: any) => {
    const members = (byConv.get(c.id) ?? []).map((p: any) => mapUser(p.profile));
    const other =
      c.type === "DIRECT"
        ? members.find((u: any) => u && u.id !== me.id) ?? null
        : null;
    const last = c.last_message_id ? lastMsgById.get(c.last_message_id) : null;
    const lastMessage = last
      ? {
          id: last.id,
          content: last.deleted_at ? null : last.content,
          senderId: last.sender_id,
          createdAt: last.created_at,
          deleted: !!last.deleted_at,
        }
      : null;
    const unread =
      !!last && last.sender_id !== me.id && !readSet.has(last.id);
    return {
      id: c.id,
      serial: c.serial,
      type: c.type,
      name: c.name,
      coverImage: c.cover_image,
      otherUser: other,
      members,
      lastMessage,
      lastMessageAt: c.last_message_at,
      unread,
      createdAt: c.created_at,
    };
  });

  return ok(result, "Conversations fetched");
}

// POST /api/chat/conversations  body { userId } -> create or return the DIRECT conversation with that user.
// NOTE: intentionally uses the admin client. Creating a direct conversation must read the OTHER user's
// participant rows (for dedup) and insert THEIR participant row — both forbidden to the actor by
// cp_select_participant / cp_insert_self. The operation is gated by the auth check + the target's
// who-can-message privacy preference below, so it's a deliberate, guarded exception to the actor-client rule.
export async function POST(request: NextRequest): Promise<Response> {
  const me = await getServerUser(request);
  if (!me) return fail("Unauthorized", 401);
  const body = await request.json().catch(() => ({}));
  const targetId: string | undefined = body.userId;
  if (!targetId) return fail("userId is required", 400);
  if (targetId === me.id) return fail("Cannot start a chat with yourself", 400);

  const db = createAdminClient();

  const { data: target } = await db
    .from("profiles")
    .select("id, username, full_name, profile_image")
    .eq("id", targetId)
    .single();
  if (!target) return fail("User not found", 404);

  // Enforce the target's who-can-message privacy preference. Read it defensively so
  // the route keeps working before the `preferences` migration reaches an env.
  let whoCanMessage = "EVERYONE";
  const { data: prefRow, error: prefErr } = await db
    .from("profiles")
    .select("preferences")
    .eq("id", targetId)
    .maybeSingle();
  if (!prefErr && prefRow)
    whoCanMessage = withDefaults((prefRow as any).preferences).privacy
      .whoCanMessage;

  if (whoCanMessage === "NONE")
    return fail("This user isn't accepting new messages", 403);
  if (whoCanMessage === "FOLLOWERS") {
    // "People you follow can message you" -> the target must follow the sender.
    const { data: rel } = await db
      .from("follows")
      .select("follower_id")
      .eq("follower_id", targetId)
      .eq("following_id", me.id)
      .maybeSingle();
    if (!rel)
      return fail("Only people this user follows can message them", 403);
  }

  // Find an existing DIRECT conversation shared by both users.
  const { data: mine } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", me.id);
  const { data: theirs } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", targetId);
  const mineIds = new Set((mine ?? []).map((r: any) => r.conversation_id));
  const shared = (theirs ?? [])
    .map((r: any) => r.conversation_id)
    .filter((id: string) => mineIds.has(id));

  let conversationId: string | null = null;
  if (shared.length) {
    const { data: existing } = await db
      .from("conversations")
      .select("id")
      .in("id", shared)
      .eq("type", "DIRECT")
      .limit(1)
      .maybeSingle();
    if (existing) conversationId = existing.id;
  }

  if (!conversationId) {
    const { data: created, error: cErr } = await db
      .from("conversations")
      .insert({ type: "DIRECT", created_by: me.id })
      .select("id")
      .single();
    if (cErr || !created) return fail(cErr?.message || "Failed to create", 500);
    conversationId = created.id;
    const { error: pErr } = await db
      .from("conversation_participants")
      .insert([
        { conversation_id: conversationId, user_id: me.id },
        { conversation_id: conversationId, user_id: targetId },
      ]);
    if (pErr) return fail(pErr.message, 500);
  }

  return ok(
    {
      id: conversationId,
      type: "DIRECT",
      otherUser: mapUser(target as Profile),
      members: [
        { id: me.id },
        mapUser(target as Profile),
      ],
      lastMessage: null,
      unread: false,
    },
    "Conversation ready"
  );
}
