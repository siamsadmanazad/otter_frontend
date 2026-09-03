/**
 * Cloudflare R2 provider (MEDIA.md §6.1). R2 speaks the S3 API, so this is the
 * AWS SDK pointed at the account's R2 endpoint.
 *
 * Two things differ from Supabase Storage in ways that matter:
 *
 *  1. **Presigned PUT TTL is ours to choose.** Supabase fixes it at 60s, which
 *     is why video could never use the direct-upload path. An hour here is what
 *     unblocks a 25MB video on a slow connection (MEDIA.md §3 G14).
 *  2. **There is no RLS.** Supabase enforced "you may only write under your own
 *     uid prefix" in the `storage` schema. On R2 that guarantee comes from this
 *     server being the ONLY issuer of presigned URLs, and every caller building
 *     paths as `${auth.uid()}/...` (MEDIA.md §3 G5). Keep the prefix: it is the
 *     audit trail even though nothing enforces it store-side.
 *
 * Public reads never touch this client — they go to the CDN-fronted custom
 * domain in R2_PUBLIC_BASE_URL. Serving bytes through a Vercel function would
 * be billed as Fast Data Transfer and is the single most expensive thing we
 * could do (MEDIA.md §1.2).
 */
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, UploadTicket } from "./types";

let client: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Cloudflare R2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_PUBLIC_BASE_URL — see MEDIA.md §5.`
    );
  }
  return value;
}

function s3(): S3Client {
  if (client) return client;
  client = new S3Client({
    // R2 ignores regions but the SDK insists on one; "auto" is Cloudflare's
    // documented value.
    region: "auto",
    endpoint:
      process.env.R2_ENDPOINT || `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

/**
 * Maps our logical bucket names onto real R2 buckets. Everything public shares
 * ONE R2 bucket with the logical name as a path prefix -- fewer buckets to
 * scope tokens and lifecycle rules against, and the prefix keeps migration
 * paths readable next to their Supabase originals.
 */
function objectKey(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

function r2Bucket(): string {
  return process.env.R2_BUCKET || "tripotter-media";
}

export const r2Provider: StorageProvider = {
  id: "r2",

  async createUploadUrl(bucket, path, contentType, ttlSeconds): Promise<UploadTicket> {
    const url = await getSignedUrl(
      s3(),
      new PutObjectCommand({
        Bucket: r2Bucket(),
        Key: objectKey(bucket, path),
        ContentType: contentType,
      }),
      { expiresIn: ttlSeconds }
    );
    return {
      provider: "r2",
      path,
      uploadUrl: url,
      method: "PUT",
      // Content-Type is part of what was signed; sending a different one fails
      // the signature check, so the client must echo this back exactly.
      headers: { "Content-Type": contentType },
      ttlSeconds,
    };
  },

  async put(bucket, path, body, contentType, cacheControl) {
    await s3().send(
      new PutObjectCommand({
        Bucket: r2Bucket(),
        Key: objectKey(bucket, path),
        Body: body,
        ContentType: contentType,
        // Supabase's SDK builds `max-age=${cacheControl}`; the S3 API takes the
        // full header value, so callers pass the same string and we prefix it.
        CacheControl: cacheControl.startsWith("max-age") ? cacheControl : `max-age=${cacheControl}`,
      })
    );
  },

  async download(bucket, path) {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: r2Bucket(), Key: objectKey(bucket, path) })
    );
    if (!res.Body) throw new Error("Object not found");
    const bytes = await res.Body.transformToByteArray();
    return {
      buffer: Buffer.from(bytes),
      contentType: res.ContentType || "application/octet-stream",
    };
  },

  async downloadRange(bucket, path, start, end) {
    const range = start < 0 ? `bytes=${start}` : `bytes=${start}-${end ?? ""}`;
    const res = await s3().send(
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: objectKey(bucket, path),
        Range: range,
      })
    );
    if (!res.Body) throw new Error("Object not found");
    const bytes = await res.Body.transformToByteArray();
    // "bytes 0-65535/1234567" -- the object's full size comes back for free on
    // a range read, which is how the media row gets size_bytes without a
    // second request or trusting a client-reported number.
    const total = Number(res.ContentRange?.split("/")[1]);
    return {
      buffer: Buffer.from(bytes),
      contentType: res.ContentType || "application/octet-stream",
      totalSize: Number.isFinite(total) ? total : undefined,
    };
  },

  async remove(bucket, paths) {
    if (paths.length === 0) return;
    await s3().send(
      new DeleteObjectsCommand({
        Bucket: r2Bucket(),
        Delete: { Objects: paths.map((p) => ({ Key: objectKey(bucket, p) })), Quiet: true },
      })
    );
  },

  publicUrl(bucket, path) {
    const base = requireEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
    return `${base}/${objectKey(bucket, path)}`;
  },
};
