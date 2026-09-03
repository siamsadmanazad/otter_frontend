/**
 * The storage seam — MEDIA.md §6.1.
 *
 * Everything that writes, reads or deletes a media object goes through this
 * interface so the backing store (Supabase Storage today, Cloudflare R2 after
 * the cutover) is one env var, not a rewrite. See MEDIA.md for why R2: its
 * egress is $0 forever, and at feed fan-out egress is ~95% of the media bill.
 */

/** Which backing store an object lives on. Persisted per-row on `media.provider`. */
export type StorageProviderId = "supabase" | "r2";

/**
 * A one-shot, pre-authorized upload handshake handed to the client so bytes go
 * device -> store DIRECTLY, never through a Vercel function (MEDIA.md §1.2).
 *
 * The two providers speak different protocols and the client has to branch:
 *  - supabase: PUT via supabase-js `uploadBinaryToSignedUrl(path, token, ...)`;
 *    the URL is valid for a fixed ONE MINUTE (a platform limit, not a choice).
 *  - r2: a plain S3 presigned PUT of the raw bytes, TTL of our choosing.
 * `ttlSeconds` is reported so the client can fail fast rather than upload into
 * an already-expired URL.
 */
export type UploadTicket = {
  provider: StorageProviderId;
  /** Object path within the bucket. Always `${auth.uid()}/...` — see MEDIA.md §3 G5. */
  path: string;
  uploadUrl: string;
  method: "PUT";
  /** Headers the client MUST send verbatim; an S3 presign covers Content-Type. */
  headers: Record<string, string>;
  /** Supabase-only: the token half of its signed-upload handshake. */
  token?: string;
  ttlSeconds: number;
};

export interface StorageProvider {
  readonly id: StorageProviderId;

  /** Pre-authorize a direct client upload to `path`. */
  createUploadUrl(
    bucket: string,
    path: string,
    contentType: string,
    ttlSeconds: number
  ): Promise<UploadTicket>;

  /** Server-side write (used for processed derivatives: WebP, posters). */
  put(
    bucket: string,
    path: string,
    body: Buffer,
    contentType: string,
    cacheControl: string
  ): Promise<void>;

  /** Server-side read (used to re-encode / moderate what the client uploaded). */
  download(bucket: string, path: string): Promise<{ buffer: Buffer; contentType: string }>;

  /**
   * Read a byte range. Video validation only needs the MP4 header, so pulling
   * a 25MB object into a Vercel function to read 64KB of it would be pure
   * waste -- of memory, of function duration, and (on R2) of nothing at all
   * since egress is free but the function time is not.
   *
   * `end` is INCLUSIVE, matching the HTTP Range header this maps onto.
   * A negative `start` means "the last N bytes" (Range: bytes=-N), which is
   * how a non-faststart file's trailing moov atom is reached.
   */
  downloadRange(
    bucket: string,
    path: string,
    start: number,
    end?: number
  ): Promise<{ buffer: Buffer; contentType: string; totalSize?: number }>;

  /** Best-effort delete. Must not throw on a missing object. */
  remove(bucket: string, paths: string[]): Promise<void>;

  /** The public, CDN-fronted URL for a public-read object. */
  publicUrl(bucket: string, path: string): string;
}
