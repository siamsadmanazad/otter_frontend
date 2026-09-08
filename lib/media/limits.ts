/**
 * The one place every media size cap is written down.
 *
 * ## Why this file exists
 *
 * Before it, `/api/media/init` signed a presigned PUT with **no length bound
 * at all** and a one-hour TTL, while the only real ceiling in the system was
 * `storage.buckets.file_size_limit` — which exists on Supabase (50MB) and has
 * no equivalent on R2. So on R2 an authenticated client could PUT an object of
 * any size, as many times as the rate limit allowed, and the first anyone would
 * know is the bill. `MAX_IMAGE_MB`/`MAX_VIDEO_MB` in `app/api/media/route.ts`
 * only ever guarded the legacy multipart route, which the app no longer uses
 * for images.
 *
 * ## How a cap is actually enforced (three layers, deliberately)
 *
 *  1. **Declared, checked before signing.** The client sends the byte count it
 *     is about to upload; `/api/media/init` refuses to sign at all if that is
 *     over the cap. Cheap, and it fails the user before they wait.
 *  2. **Signed into the URL (R2 only).** The presign covers `content-length`,
 *     so the store itself rejects a PUT whose body is a different size —
 *     verified against the live bucket: a matching PUT returns 200, one four
 *     times the declared length returns **403**. This is the layer that does
 *     not depend on the client being honest.
 *  3. **Re-measured at `/complete`.** Whatever actually landed is checked
 *     against the cap again and deleted if it is over. This is what covers
 *     Supabase, whose signed-upload URLs cannot bind a length, and any client
 *     too old to declare one.
 *
 * Layer 2 is the only one an attacker cannot route around, which is why the
 * R2 cutover matters for more than just the egress bill.
 */

/**
 * A photo leaves the app through `MediaCompressor`, which targets ~260KB and
 * has a hard ceiling of 420KB. 8MB is therefore ~20x the real workload: it is
 * sized to still admit an uncompressed original from an old client or the web
 * (where nothing shrinks the file), while refusing anything that could only be
 * a raw camera master or an attack.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * MEDIA.md §7.3: a compliant 120s 720p clip is ~25MB, and 40MB leaves headroom
 * for a device whose encoder overshot without leaving room for an untranscoded
 * original. This supersedes the legacy route's `MAX_VIDEO_MB = 50`.
 */
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

export type MediaKind = "image" | "video";

export function maxBytesFor(kind: MediaKind): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

/** `8MB` / `40MB` — for user-facing copy, so the number is never hardcoded twice. */
export function formatCap(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * Validates a client-declared byte count.
 *
 * Returns an error string to send back, or null when the value is acceptable.
 * `undefined` is allowed on purpose for images: builds already installed on
 * phones do not send this field, and MEDIA.md §6.3 commits to keeping them
 * working. Those uploads fall through to layer 3 above. Video has no legacy
 * client to protect — `/api/media/init` has refused video on every deployment
 * shipped so far — so it is required there.
 */
export function checkDeclaredLength(
  declared: unknown,
  kind: MediaKind
): { error: string } | { bytes: number | undefined } {
  const cap = maxBytesFor(kind);
  if (declared === undefined || declared === null) {
    if (kind === "video") {
      return { error: "contentLength is required for video uploads." };
    }
    return { bytes: undefined };
  }
  if (typeof declared !== "number" || !Number.isSafeInteger(declared) || declared <= 0) {
    return { error: "contentLength must be a positive integer number of bytes." };
  }
  if (declared > cap) {
    return {
      error:
        kind === "video"
          ? `Videos must be under ${formatCap(cap)}.`
          : `Images must be under ${formatCap(cap)}.`,
    };
  }
  return { bytes: declared };
}
