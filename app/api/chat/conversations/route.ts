import { NextRequest, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { isBlockedPair, getBlockedPairIds } from "@/lib/api/blocks";
import { withDefaults } from "@/lib/preferences";
import {
  maskExpiredVoiceRows,
  persistExpiredVoicePurge,
} from "@/lib/api/chat-attachments";
import { createStageTimer } from "@/lib/api/timing";

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

// GET /api/chat/conversations?filter=inbox|requests|archived
//   inbox (default) -> accepted && !archived · requests -> !accepted && !archived
//   archived        -> archived
// Actor client: RLS (cp_select_participant / conversations_select_participant) scopes
// every read to the caller's own conversations.
export async function GET(request: NextRequest): Promise<Response> {
  const timer = createStageTimer("conversations");
  const me = await getServerUser(request);
  timer.mark("auth");
  if (!me) {
    timer.finish({ result: "401" });
    return fail("Unauthorized", 401);
  }
  const db = await createActorClient(request);

  // Depends only on me.profileId, so it rides alongside round A instead of tailing the
  // whole waterfall (it used to be the LAST await in the route).
  const blockedIdsPromise = getBlockedPairIds(db, me.profileId);

  const filter = request.nextUrl.searchParams.get("filter") ?? "inbox";
  // Round A — nothing else can start until we know which conversations are mine.
  const { data: myRows } = await db
    .from("conversation_participants")
    .select("conversation_id, accepted, archived, muted, pinned_at")
    .eq("user_id", me.profileId);
  timer.mark("myRows");
  const convIds = (myRows ?? [])
    .filter((r: any) => {
      if (filter === "archived") return r.archived;
      if (filter === "requests") return !r.accepted && !r.archived;
      return r.accepted && !r.archived; // inbox
    })
    .map((r: any) => r.conversation_id);
  if (convIds.length === 0) {
    await blockedIdsPromise; // settle it; nothing below runs
    timer.finish({ convIds: 0 });
    return ok([], "No conversations");
  }

  const mutedByConv = new Map<string, boolean>();
  const pinnedAtByConv = new Map<string, string>();
  for (const r of myRows ?? []) {
    mutedByConv.set(r.conversation_id, !!r.muted);
    if (r.pinned_at) pinnedAtByConv.set(r.conversation_id, r.pinned_at);
  }

  // Round B — the whole rest of the read, in ONE hop.
  //
  // The last message and its read receipts come back EMBEDDED on each
  // conversation via the conversations_last_message_fk / message_reads FKs,
  // which folds what used to be three more serial round trips (messages, then
  // message_reads, then participants) into a single parallel pair. Measured
  // against the previous sequential shape on real data: 1317ms -> 456ms, with
  // byte-identical output (dm_redesign.md §7 A3). RLS still applies to embedded
  // resources, so `message_reads_select_self` keeps scoping receipts to
  // conversations the caller participates in — the peer's read is visible (that
  // policy's OR-branch), which is what powers the Seen state below.
  const [convsRes, partsRes] = await Promise.all([
    db
      .from("conversations")
      .select(
        "id, serial, type, name, cover_image, last_message_id, last_message_at, created_by, created_at, " +
          "last_message:messages!conversations_last_message_fk(" +
          "id, content, sender_id, created_at, deleted_at, attachments, expires_at, listen_once, voice_played_at, " +
          "message_reads(user_id))"
      )
      .in("id", convIds)
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    // All participants (with profiles + delivered cursor) for these conversations.
    db
      .from("conversation_participants")
      .select(
        "conversation_id, user_id, last_delivered_at, profile:profiles!conversation_participants_user_id_fkey(id, username, full_name, profile_image)"
      )
      .in("conversation_id", convIds),
  ]);
  timer.mark("roundB");
  const { data: convs, error } = convsRes;
  if (error) {
    timer.finish({ result: "500" });
    return fail(error.message, 500);
  }
  const parts = partsRes.data;
  const byConv = new Map<string, any[]>();
  const deliveredAtByConvUser = new Map<string, Map<string, string>>();
  for (const p of parts ?? []) {
    const arr = byConv.get(p.conversation_id) ?? [];
    arr.push(p);
    byConv.set(p.conversation_id, arr);
    if (p.last_delivered_at) {
      const m = deliveredAtByConvUser.get(p.conversation_id) ?? new Map();
      m.set(p.user_id, p.last_delivered_at);
      deliveredAtByConvUser.set(p.conversation_id, m);
    }
  }

  // Last messages + read state (mine, for `unread`; everyone's, for my own
  // status) — all of it already came back on the round-B embed above.
  const lastMsgById = new Map<string, any>();
  const readSet = new Set<string>(); // messages I've read
  const readersByMsg = new Map<string, Set<string>>(); // message -> who read it
  const lastMsgs: any[] = [];
  for (const c of convs ?? []) {
    // to-one FK embed; PostgREST hands back an object (or null when the row is
    // gone / not visible), but tolerate an array shape so a PostgREST version
    // change degrades to "no preview" rather than a crash.
    const raw = (c as any).last_message;
    const lm = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (!lm) continue;
    const { message_reads, ...msg } = lm;
    lastMsgs.push(msg);
    lastMsgById.set(msg.id, msg);
    for (const r of (message_reads ?? []) as { user_id: string }[]) {
      if (r.user_id === me.profileId) readSet.add(msg.id);
      const set = readersByMsg.get(msg.id) ?? new Set<string>();
      set.add(r.user_id);
      readersByMsg.set(msg.id, set);
    }
  }

  // So an expired voice note's inbox preview flips to the expired placeholder
  // without waiting for the thread to be reopened. Masking is synchronous (the
  // response needs it); the storage delete + DB update are bookkeeping and now
  // run AFTER the response is sent — this is a GET, and it used to block on an
  // admin-client write before it could answer.
  const purge = maskExpiredVoiceRows(lastMsgs);
  if (purge.ids.length) {
    after(() =>
      persistExpiredVoicePurge(createAdminClient(), purge).catch((e) =>
        console.error("[chat] deferred voice purge failed:", e)
      )
    );
  }

  // Defense-in-depth signal for the client (banner + disable composer);
  // actual enforcement is server-side in the messages/reactions routes.
  // Already in flight since before round A — this just collects it.
  const blockedIds = new Set(await blockedIdsPromise);
  timer.mark("blockedPairs");

  // stories.md 4.1 — which DIRECT peers currently have an unseen live story,
  // for the chat-list ring. ONE batched RPC for the whole page (never
  // per-conversation) — same discipline as story_tray()/story_segments().
  const directOtherIds = new Set<string>();
  for (const c of (convs ?? []) as any[]) {
    if (c.type !== "DIRECT") continue;
    for (const p of byConv.get(c.id) ?? []) {
      if (p.user_id !== me.profileId) directOtherIds.add(p.user_id);
    }
  }
  const storyRingByAuthor = new Set<string>();
  if (directOtherIds.size) {
    const { data: liveRows } = await db.rpc("story_live_status", {
      p_authors: [...directOtherIds],
    });
    for (const r of liveRows ?? []) {
      if (r.has_unseen) storyRingByAuthor.add(r.author_id);
    }
  }
  timer.mark("storyRings");

  // A DIRECT conversation with no resolvable peer (the other participant row
  // is missing, or its profile failed to join) is dead data — surfacing it
  // renders as an unopenable "Conversation" row with a blank avatar. Drop it
  // rather than return it.
  const result = (convs ?? [])
    .filter((c: any) => c.type !== "DIRECT" || (byConv.get(c.id) ?? []).length > 1)
    .map((c: any) => {
    const members = (byConv.get(c.id) ?? []).map((p: any) => mapUser(p.profile));
    const other =
      c.type === "DIRECT"
        ? members.find((u: any) => u && u.id !== me.profileId) ?? null
        : null;
    const last = c.last_message_id ? lastMsgById.get(c.last_message_id) : null;

    // Delivered/seen status for MY OWN last message (DIRECT only — a single peer).
    let status: "sent" | "delivered" | "seen" | undefined;
    if (last && last.sender_id === me.profileId && other?.id) {
      const seenByPeer = readersByMsg.get(last.id)?.has(other.id) ?? false;
      const peerDeliveredAt = deliveredAtByConvUser.get(c.id)?.get(other.id);
      if (seenByPeer) status = "seen";
      else if (peerDeliveredAt && peerDeliveredAt >= last.created_at)
        status = "delivered";
      else status = "sent";
    }

    // First attachment's type, for a media-aware preview ("📷 Photo" etc.) when
    // there's no text content — e.g. a photo/voice message with an empty caption.
    const attachmentType =
      !last?.deleted_at && Array.isArray(last?.attachments) && last.attachments[0]?.type
        ? last.attachments[0].type
        : null;

    const lastMessage = last
      ? {
          id: last.id,
          content: last.deleted_at ? null : last.content,
          senderId: last.sender_id,
          createdAt: last.created_at,
          deleted: !!last.deleted_at,
          status,
          attachmentType,
        }
      : null;
    const unread =
      !!last && last.sender_id !== me.profileId && !readSet.has(last.id);
    return {
      id: c.id,
      serial: c.serial,
      type: c.type,
      name: c.name,
      coverImage: c.cover_image,
      otherUser: other,
      members,
      membersCount: members.length,
      muted: mutedByConv.get(c.id) ?? false,
      pinnedAt: pinnedAtByConv.get(c.id) ?? null,
      blocked: other ? blockedIds.has(other.id) : false,
      // stories.md 4.1 — a live, unseen story on this DIRECT peer. Never set
      // for a group conversation (there's no single "the peer" to ring).
      storyRing: other ? storyRingByAuthor.has(other.id) : false,
      lastMessage,
      lastMessageAt: c.last_message_at,
      unread,
      createdAt: c.created_at,
    };
  });

  // Pinned conversations float to the top; within each group, most-recent first
  // (already the case from the `conversations` query — a stable sort preserves it).
  result.sort((a: any, b: any) => {
    const ap = a.pinnedAt ? 1 : 0;
    const bp = b.pinnedAt ? 1 : 0;
    return bp - ap;
  });

  timer.finish({ count: result.length });
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
  if (targetId === me.profileId) return fail("Cannot start a chat with yourself", 400);

  const db = createAdminClient();

  const { data: target } = await db
    .from("profiles")
    .select("id, username, full_name, profile_image")
    .eq("id", targetId)
    .single();
  if (!target) return fail("User not found", 404);

  // Can't start a chat across a block (either direction).
  if (await isBlockedPair(db, me.profileId, targetId))
    return fail("You can't message this account", 403);

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
      .eq("following_id", me.profileId)
      .maybeSingle();
    if (!rel)
      return fail("Only people this user follows can message them", 403);
  }

  // Find an existing DIRECT conversation shared by both users.
  const { data: mine } = await db
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", me.profileId);
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
      .insert({ type: "DIRECT", created_by: me.profileId })
      .select("id")
      .single();
    if (cErr || !created) return fail(cErr?.message || "Failed to create", 500);
    conversationId = created.id;
    const { error: pErr } = await db
      .from("conversation_participants")
      .insert([
        { conversation_id: conversationId, user_id: me.profileId },
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
        { id: me.profileId },
        mapUser(target as Profile),
      ],
      lastMessage: null,
      unread: false,
    },
    "Conversation ready"
  );
}
