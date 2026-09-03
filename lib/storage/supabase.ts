/**
 * Supabase Storage provider — the incumbent. Every method here is a verbatim
 * lift of what app/api/media/* already did, so `MEDIA_PROVIDER=supabase`
 * (the default) is a behavioural no-op and can be rolled back to at any time.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { StorageProvider, UploadTicket } from "./types";

/**
 * Supabase's signed upload URLs are valid for exactly 60 seconds and the TTL
 * is NOT configurable. Reported honestly on the ticket so callers can decide
 * (this is precisely why video never used this path — MEDIA.md §3 G14).
 */
const SUPABASE_SIGNED_UPLOAD_TTL = 60;

export const supabaseProvider: StorageProvider = {
  id: "supabase",

  async createUploadUrl(bucket, path, contentType): Promise<UploadTicket> {
    const db = createAdminClient();
    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message || "Could not create upload URL");
    return {
      provider: "supabase",
      path: data.path,
      uploadUrl: data.signedUrl,
      method: "PUT",
      headers: { "Content-Type": contentType },
      token: data.token,
      ttlSeconds: SUPABASE_SIGNED_UPLOAD_TTL,
    };
  },

  async put(bucket, path, body, contentType, cacheControl) {
    const db = createAdminClient();
    const { error } = await db.storage.from(bucket).upload(path, body, {
      contentType,
      upsert: false,
      cacheControl,
    });
    if (error) throw new Error(error.message);
  },

  async download(bucket, path) {
    const db = createAdminClient();
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data) throw new Error(error?.message || "Object not found");
    return {
      buffer: Buffer.from(await data.arrayBuffer()),
      contentType: data.type || "application/octet-stream",
    };
  },

  /**
   * Supabase's storage SDK has no range read, so this degrades to a full
   * download and slices locally. Correct, just not cheap -- which is
   * acceptable because the composer's video path is R2-only (see
   * /api/media/init), so this is only ever reached for small images.
   */
  async downloadRange(bucket, path, start, end) {
    const { buffer, contentType } = await supabaseProvider.download(bucket, path);
    const slice =
      start < 0
        ? buffer.subarray(Math.max(0, buffer.length + start))
        : buffer.subarray(start, end === undefined ? undefined : end + 1);
    return { buffer: slice, contentType, totalSize: buffer.length };
  },

  async remove(bucket, paths) {
    if (paths.length === 0) return;
    const db = createAdminClient();
    await db.storage.from(bucket).remove(paths);
  },

  publicUrl(bucket, path) {
    return createAdminClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
  },
};
