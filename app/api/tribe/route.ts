import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail, mapTribe, mapPublicUser } from "@/lib/api/http";

type DB = ReturnType<typeof createAdminClient>;

const TRIBE_COLS =
  "id, serial, name, description, category, tags, cover_image, profile_image, created_by, privacy, created_at, updated_at";

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
  const [{ count: usersCount }, { count: postsCount }] = await Promise.all([
    db.from("tribe_members").select("user_id", { count: "exact", head: true }).eq("tribe_id", t.id),
    db.from("posts").select("id", { count: "exact", head: true }).eq("tribe_id", t.id),
  ]);
  return {
    ...mapTribe(t),
    createdBy: mapPublicUser((t as any).creator),
    usersCount: usersCount ?? 0,
    postsCount: postsCount ?? 0,
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
    .select("u:profiles!tribe_members_user_id_fkey(id, username, full_name, profile_image)")
    .eq("tribe_id", tribeId)
    .range(from, to);
  return ((data ?? []) as any[]).map((r) => mapPublicUser(r.u));
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
  const member = sp.get("member") ?? "";
  const posts = sp.get("posts") ?? "";
  const ownership = sp.get("ownership") ?? "";

  try {
    const db = createAdminClient();
    let payload: unknown = [];

    if (member === "true" && tribeId && page && limit) {
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
    return ok(payload, "Get tribes");
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
        created_by: user.id,
      })
      .select(TRIBE_COLS)
      .single();
    if (error) return fail(error.message, 500);

    // creator is also a member
    await db.from("tribe_members").insert({ tribe_id: tribe.id, user_id: user.id });
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
    };
    const update: Record<string, unknown> = {};
    for (const [k, col] of Object.entries(allowed)) if (k in b) update[col] = b[k];

    const db = createAdminClient();
    const { data, error } = await db
      .from("tribes")
      .update(update)
      .eq("serial", serial)
      .eq("created_by", user.id)
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
