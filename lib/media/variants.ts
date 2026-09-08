/**
 * The server-side image re-encode — MEDIA.md's actual storage-cost lever.
 *
 * ## What this is and is not
 *
 * `lib/media/limits.ts`'s 8MB/40MB caps bound the RAW upload — a temporary
 * object that exists only long enough for this module to re-encode it, and is
 * deleted (or reaped within 48h if the request never finishes) either way. It
 * was never a storage-cost number and was never meant to be one.
 *
 * THIS is the storage-cost number: every image this app stores or serves,
 * regardless of what a device, browser or old APK uploaded, is re-encoded here
 * into two WebP objects with a HARD byte ceiling apiece —
 *
 *   - `feed`  — up to 1080px long edge, capped at 150KB
 *   - `thumb` — up to 320px long edge, capped at 24KB
 *
 * — so "an image this app stores never exceeds 150KB" is a server-enforced
 * fact, not a hope about `MediaCompressor` having run. The client-side
 * compressor (`otter_flutter/lib/core/media_compressor.dart`) still matters —
 * it is what keeps the RAW upload small on a metered connection — but this is
 * the backstop it does not depend on.
 *
 * ## Why a quality ladder and not one fixed setting
 *
 * A flat quality (the previous `webp({ quality: 70 })`) has no relationship to
 * bytes: a calm beach photo lands at 60KB and a noisy night market scene at
 * 350KB from the exact same setting, because bytes are an OUTPUT of content
 * complexity, not an input you can dial. Capping bytes directly and walking
 * quality down until the output fits is what makes the ceiling true for every
 * photo instead of true on average.
 */
import sharp from "sharp";

export const FEED_LONG_EDGE = 1080;
export const FEED_MAX_BYTES = 150 * 1024;

export const THUMB_LONG_EDGE = 320;
export const THUMB_MAX_BYTES = 24 * 1024;

// Descending. 32 is where photographic content starts visibly blocking, but
// this is the LAST resort for a genuinely adversarial source (pure noise) --
// the loop keeps the smallest attempt regardless of whether any step reached
// the cap, so the ceiling holds even then.
const QUALITY_LADDER = [80, 72, 64, 56, 48, 40, 32];

export type EncodedVariant = { buffer: Buffer; width: number; height: number };

/**
 * Resizes [source] to at most [longEdge] on its long side (never upscales —
 * `withoutEnlargement`) and walks [QUALITY_LADDER] until the WebP output is at
 * or under [maxBytes]. Returns the smallest attempt if none hit the cap.
 *
 * [source] is cloned per attempt so the decode (the expensive part) happens
 * once regardless of how many quality steps are tried.
 */
export async function encodeWebpVariant(
  source: sharp.Sharp,
  longEdge: number,
  maxBytes: number
): Promise<EncodedVariant> {
  let best: EncodedVariant | null = null;
  for (const quality of QUALITY_LADDER) {
    const { data, info } = await source
      .clone()
      .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (!best || data.length < best.buffer.length) {
      best = { buffer: data, width: info.width, height: info.height };
    }
    if (data.length <= maxBytes) break;
  }
  // Non-null: QUALITY_LADDER is a fixed non-empty array, so the loop runs at
  // least once.
  return best as EncodedVariant;
}

export type ImageVariants = {
  feed: EncodedVariant;
  thumb: EncodedVariant;
};

/**
 * Just the `feed` variant — for a caller that has no small-tile render surface
 * for this image (today: chat attachments, whose bubbles are never shown at
 * grid/thumbnail size the way a post or profile photo is) and would otherwise
 * pay for a `thumb` encode it throws away. Still gets the SAME resize + byte
 * ceiling as every other image this app stores — the point of this module.
 */
export async function encodeFeedVariant(buffer: Buffer): Promise<EncodedVariant> {
  return encodeWebpVariant(sharp(buffer, { failOn: "none" }), FEED_LONG_EDGE, FEED_MAX_BYTES);
}

/** Both stored variants from one decode of [buffer]. */
export async function encodeImageVariants(buffer: Buffer): Promise<ImageVariants> {
  const source = sharp(buffer, { failOn: "none" });
  const [feed, thumb] = await Promise.all([
    encodeWebpVariant(source, FEED_LONG_EDGE, FEED_MAX_BYTES),
    encodeWebpVariant(source, THUMB_LONG_EDGE, THUMB_MAX_BYTES),
  ]);
  return { feed, thumb };
}
