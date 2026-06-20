import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/auth/server";

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
    .select("id, bucket, path, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!media || media.owner_id !== user.id) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }
  await db.storage.from(media.bucket).remove([media.path]);
  await db.from("media").delete().eq("id", id);
  return NextResponse.json({ message: "Media deleted", id });
}
