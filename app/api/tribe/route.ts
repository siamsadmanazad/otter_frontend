import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail, mapTribe, mapPublicUser } from "@/lib/api/http";
import { captureRouteError } from "@/lib/observability";

type DB = ReturnType<typeof createAdminClient>;

const TRIBE_COLS =
  "id, serial, name, description, category, tags, cover_image, profile_image, created_by, privacy, rules, destination, trip_start, trip_end, member_count, post_count, created_at, updated_at";

function range(page: string, limit: string) {
  const p = Math.max(1, parseInt(page || "1", 10));
  const l = Math.max(1, parseInt(limit || "10", 10));
  return { from: (p - 1) * l, to: (p - 1) * l + l - 1 };
}

// Tribe detail (populated creator + counts) — fixes the old empty-creator bug.
async function tribeDetail(db: DB, col: "id" | "serial", val: string) {
  const { data: t } = await db
    .from("tribes")
    .select(`${TRIBE_COLS}, creator:profiles!tribes_created_by_fkey(id, username, full_name, profile_image)`)
    .eq(col, val)
    .single();
  if (!t) return null;
  const [users, posts] = await Promise.all([
    db.from("tribe_members").select("user_id", { count: "exact", head: true }).eq("tribe_id", t.id),
    db.from("posts").select("id", { count: "exact", head: true }).eq("tribe_id", t.id),
  ]);
  // Secondary enrichment (D14, same pattern as GET /api/users): these 2 count
  // queries can fail independently of the primary tribe fetch. supabase-js
  // resolves with `{ error }` rather than rejecting, so a failure here would
  // otherwise be silently coalesced into a misleading "0" via `?? 0` below.
  const countErrors = [users.error, posts.error].filter(Boolean);
  if (countErrors.length) {
    captureRouteError("tribe counts enrichment degraded", {
      tribeId: t.id,
      errors: countErrors.map((e) => e!.message),
    });
  }
  return {
    ...mapTribe(t),
    createdBy: mapPublicUser((t as any).creator),
    usersCount: users.count ?? 0,
    postsCount: posts.count ?? 0,
    // Embedded (not just the top-level envelope) because the mobile client's
    // ApiClient unwraps to `body.data` and drops sibling envelope keys.
    ...(countErrors.length ? { partial: true } : {}),
  };
}

async function listTribes(db: DB, page: string, limit: string) {
  const { from, to } = range(page, limit);
  const { data } = await db
    .from("tribes")
    .select(TRIBE_COLS)
    .order("created_at", { ascending: false })
    .range(from, to);
  return (data ?? []).map(mapTribe);
}

async function tribeMembers(db: DB, tribeId: string, page: string, limit: string) {
  const { from, to } = range(page, limit);
  const { data } = await db
    .from("tribe_members")
    .select("role, u:profiles!tribe_members_user_id_fkey(id, username, full_name, profile_image)")
    .eq("tribe_id", tribeId)
    // leaders first: enum sort order is MEMBER<MODERATOR<ADMIN<FOUNDER, so desc.
    .order("role", { ascending: false })
    .range(from, to);
  return ((data ?? []) as any[]).map((r) => ({ ...mapPublicUser(r.u), role: r.role ?? "MEMBER" }));
}

async function tribePosts(db: DB, tribeId: string, page: string, limit: string) {
  const { from, to } = range(page, limit);
  const { data } = await db
    .from("posts")
    .select("id")
    .eq("tribe_id", tribeId)
    .order("created_at", { ascending: false })
    .range(from, to);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const posts = await Promise.all(
    ids.map(async (id) => {
      const { data: p } = await db.rpc("build_post_json", { p_post_id: id });
      return p;
    })
  );
  return posts.filter(Boolean);
}

async function tribesByOwnership(
  db: DB,
  ownership: string,
  userId: string,
  page: string,
  limit: string
) {
  const { from, to } = range(page || "1", limit || "50");
  if (ownership === "created") {
    const { data } = await db
      .from("tribes")
      .select(TRIBE_COLS)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .range(from, to);
    return (data ?? []).map(mapTribe);
  }
  // joined tribe ids
  const { data: memberRows } = await db
    .from("tribe_members")
    .select("tribe_id")
    .eq("user_id", userId);
  const joinedIds = ((memberRows ?? []) as { tribe_id: string }[]).map((r) => r.tribe_id);

  if (ownership === "joined") {
    if (joinedIds.length === 0) return [];
    const { data } = await db
      .from("tribes")
      .select(TRIBE_COLS)
      .in("id", joinedIds)
      .order("created_at", { ascending: false })
      .range(from, to);
    return (data ?? []).map(mapTribe);
  }
  // notJoined: public tribes the user neither created nor joined
  let q = db
    .from("tribes")
    .select(TRIBE_COLS)
    .eq("privacy", "PUBLIC")
    .neq("created_by", userId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (joinedIds.length > 0) q = q.not("id", "in", `(${joinedIds.join(",")})`);
  const { data } = await q;
  return (data ?? []).map(mapTribe);
}

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const sp = request.nextUrl.searchParams;
  const tribeId = sp.get("id") ?? "";
  const serial = sp.get("serial") ?? "";
  const page = sp.get("page") ?? "";
  const limit = sp.get("limit") ?? "";
  const userId = sp.get("user") ?? "";
  const members = sp.get("members") ?? "";
  const posts = sp.get("posts") ?? "";
  const ownership = sp.get("ownership") ?? "";

  try {
    const db = createAdminClient();
    let payload: unknown = [];

    if (members === "true" && tribeId && page && limit) {
      payload = await tribeMembers(db, tribeId, page, limit);
    } else if (posts === "true" && tribeId && page && limit) {
      payload = await tribePosts(db, tribeId, page, limit);
    } else if (ownership) {
      payload = await tribesByOwnership(db, ownership, user.id, page, limit);
    } else if (page && limit) {
      payload = await listTribes(db, page, limit);
    } else if (tribeId) {
      payload = await tribeDetail(db, "id", tribeId);
    } else if (userId) {
      payload = await tribesByOwnership(db, "joined", userId, page, limit);
    } else if (serial) {
      payload = await tribeDetail(db, "serial", serial);
    }
    const partial = Boolean(payload && typeof payload === "object" && (payload as any).partial);
    return ok(payload, "Get tribes", 200, partial);
  } catch (e) {
    console.error("GET /api/tribe error:", e);
    return fail("Internal server error", 500);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const b = await request.json();
    if (!b.name?.trim()) return fail("Tribe name is required", 400);

    const db = createAdminClient();
    const { data: tribe, error } = await db
      .from("tribes")
      .insert({
        name: b.name,
        description: b.description ?? null,
        category: b.category ?? "COMMUNITY",
        tags: b.tags ?? [],
        cover_image: b.coverImage ?? null,
        profile_image: b.profileImage ?? null,
        privacy: b.privacy ?? "PUBLIC",
        rules: b.rules ?? null,
        destination: b.destination ?? null,
        trip_start: b.tripStart ?? null,
        trip_end: b.tripEnd ?? null,
        created_by: user.id,
      })
      .select(TRIBE_COLS)
      .single();
    if (error) return fail(error.message, 500);

    // creator is also a member — and the FOUNDER
    await db
      .from("tribe_members")
      .insert({ tribe_id: tribe.id, user_id: user.id, role: "FOUNDER" });
    return ok(mapTribe(tribe), "Created tribe");
  } catch (e) {
    console.error("POST /api/tribe error:", e);
    return fail("Failed to create tribe", 500);
  }
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const serial = request.nextUrl.searchParams.get("serial") ?? "";
    if (!serial) return fail("Tribe serial is required", 400);
    const b = await request.json();
    const allowed: Record<string, string> = {
      name: "name",
      description: "description",
      category: "category",
      tags: "tags",
      coverImage: "cover_image",
      profileImage: "profile_image",
      privacy: "privacy",
      rules: "rules",
      destination: "destination",
      tripStart: "trip_start",
      tripEnd: "trip_end",
    };
    const update: Record<string, unknown> = {};
    for (const [k, col] of Object.entries(allowed)) if (k in b) update[col] = b[k];

    const db = createAdminClient();
    // Authorize: creator OR a moderator/admin/founder of this tribe may edit.
    const { data: tribeRow } = await db
      .from("tribes")
      .select("id")
      .eq("serial", serial)
      .single();
    if (!tribeRow) return fail("Tribe not found", 404);
    const { data: canMod } = await db.rpc("can_moderate_tribe", {
      p_tribe_id: tribeRow.id,
      p_uid: user.id,
    });
    if (!canMod) return fail("Not allowed to edit this tribe", 403);

    const { data, error } = await db
      .from("tribes")
      .update(update)
      .eq("serial", serial)
      .select(TRIBE_COLS)
      .single();
    if (error || !data) return fail("Failed updating tribe", 400);
    return ok(mapTribe(data), "Tribe updated");
  } catch (e) {
    console.error("PATCH /api/tribe error:", e);
    return fail("Failed updating tribe", 500);
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  try {
    const tribeId = request.nextUrl.searchParams.get("id") ?? "";
    if (!tribeId) return fail("Tribe id is required", 400);
    const db = createAdminClient();
    const { data, error } = await db
      .from("tribes")
      .delete()
      .eq("id", tribeId)
      .eq("created_by", user.id)
      .select("id")
      .single();
    if (error || !data) return fail("Failed deleting tribe", 400);
    return ok({ id: tribeId }, "Deleted Tribe");
  } catch (e) {
    console.error("DELETE /api/tribe error:", e);
    return fail("Failed deleting tribe", 500);
  }
}
