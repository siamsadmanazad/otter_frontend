import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { withDefaults, mergePreferences } from "@/lib/preferences";

const patchSchema = z.object({
  notifications: z
    .object({
      likes: z.boolean(),
      comments: z.boolean(),
      follows: z.boolean(),
      messages: z.boolean(),
      mentions: z.boolean(),
      email: z.boolean(),
    })
    .partial()
    .optional(),
  privacy: z
    .object({
      profileVisibility: z.enum(["PUBLIC", "FOLLOWERS", "PRIVATE"]),
      whoCanMessage: z.enum(["EVERYONE", "FOLLOWERS", "NONE"]),
      showActivity: z.boolean(),
    })
    .partial()
    .optional(),
  business: z
    .object({
      isBusiness: z.boolean(),
      businessName: z.string().max(120),
      category: z.string().max(80),
      website: z.string().max(200),
      contactEmail: z.string().max(200),
    })
    .partial()
    .optional(),
  onboarding: z
    .object({
      completed: z.boolean(),
      interests: z.array(z.string().max(40)).max(30),
    })
    .partial()
    .optional(),
});

// GET /api/settings -> the caller's preferences, merged over defaults.
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const db = createAdminClient();
  const { data, error } = await db
    .from("profiles")
    .select("preferences, role")
    .eq("id", user.id)
    .single();
  if (error) return fail(error.message, 500);
  return ok(
    { preferences: withDefaults(data?.preferences), role: data?.role },
    "Preferences fetched"
  );
}

// PATCH /api/settings  body { notifications?, privacy?, business? } -> deep-merge + save.
export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getServerUser(request);
  if (!user) return fail("Unauthorized", 401);
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message || "Invalid preferences", 400);

  const db = createAdminClient();
  const { data: current, error: readErr } = await db
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single();
  if (readErr) return fail(readErr.message, 500);

  const merged = mergePreferences(withDefaults(current?.preferences), parsed.data);
  const { error: writeErr } = await db
    .from("profiles")
    .update({ preferences: merged })
    .eq("id", user.id);
  if (writeErr) return fail(writeErr.message, 500);

  return ok({ preferences: merged }, "Preferences saved");
}
