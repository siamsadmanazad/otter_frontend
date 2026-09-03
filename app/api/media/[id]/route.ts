import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";
import { providerFor } from "@/lib/storage";

// DELETE /api/media/[id] -> remove storage object + media row (owner-scoped)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Media ID is required" }, { status: 400 });

  const db = createAdminClient();
  const { data: media } = await db
    .from("media")
    .select("id, bucket, path, owner_id, provider")
    .eq("id", id)
    .maybeSingle();
  if (!media || media.owner_id !== user.profileId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  // Deletes follow the ROW's provider, never the current flag (MEDIA.md §6.2).
  await providerFor(media.provider).remove(media.bucket, [media.path]);
  await db.from("media").delete().eq("id", id);
  return NextResponse.json({ message: "Media deleted", id });
}
