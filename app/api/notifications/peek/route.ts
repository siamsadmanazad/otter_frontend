import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createActorClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";

// GET /api/notifications/peek -> unread notification counts for every OTHER
// profile the caller may act as (their own EXPLORER profile plus any
// BUSINESS they staff), excluding whichever one is currently active.
//
// Notifications are already fully siloed per profile (recipient_id ->
// current_profile_id() at write time, filtered the same way on read) — this
// route doesn't change that. It's a read-only cross-profile SUMMARY so the
// switcher can show "3 new as Deep Diving instructor" without merging or
// exposing the other profile's actual notification rows.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);

  const db = await createActorClient(request);
  const { data: profiles, error } = await db.rpc("my_profiles");
  if (error) return fail(error.message, 500);

  const others = (profiles ?? []).filter(
    (p: any) => p.id !== user.profileId
  );
  if (others.length === 0) return ok([], "No other profiles");

  const otherIds = others.map((p: any) => p.id);
  const admin = createAdminClient();
  const { data: unreadRows, error: countErr } = await admin
    .from("notifications")
    .select("recipient_id")
    .in("recipient_id", otherIds)
    .eq("read", false);
  if (countErr) return fail(countErr.message, 500);

  const counts = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    counts.set(r.recipient_id, (counts.get(r.recipient_id) ?? 0) + 1);
  }

  const result = others
    .map((p: any) => ({
      profileId: p.id,
      kind: p.kind,
      username: p.username,
      fullName: p.full_name,
      profileImage: p.profile_image,
      unreadCount: counts.get(p.id) ?? 0,
    }))
    .filter((p: any) => p.unreadCount > 0)
    .sort((a: any, b: any) => b.unreadCount - a.unreadCount);

  return ok(result, "Peek fetched");
}
