/**
 * PERFORMANCE.md Phase 0 (P1-11): seed scripts used to fetch avatars/photos
 * from loremflickr/picsum/pravatar/images.unsplash.com at seed time -- which
 * means every baseline latency measurement Phase 0 takes would actually be
 * measuring those third parties, not this app. This generates small,
 * deterministic placeholder images locally via `sharp` (already a
 * dependency -- zero network calls) and uploads each one to the SAME
 * Storage bucket a real upload would use, so seeded posts exercise the real
 * CDN/cache-hit delivery path instead of a third party's.
 *
 * Deliberately plain Storage REST calls, not @supabase/supabase-js, so this
 * works uniformly from every seed script -- including seed_demo_feed.mjs's
 * intentionally SDK-free setup (it avoids supabase-js for the Node-20
 * WebSocket requirement).
 *
 * Idempotent: the storage path is a hash of (seed, width, height), uploaded
 * with `x-upsert: true`, so re-running a seed script never re-uploads or
 * duplicates a fixture that already exists.
 */
import sharp from "sharp";
import crypto from "node:crypto";

const cache = new Map();

function hashHue(seed) {
  const hash = crypto.createHash("md5").update(String(seed)).digest();
  return hash[0] / 255;
}

// Minimal HSL -> RGB (0..1 h/s/l in, 0..255 r/g/b out). No dependency.
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 1 / 6) [r, g, b] = [c, x, 0];
  else if (h < 2 / 6) [r, g, b] = [x, c, 0];
  else if (h < 3 / 6) [r, g, b] = [0, c, x];
  else if (h < 4 / 6) [r, g, b] = [0, x, c];
  else if (h < 5 / 6) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Returns `localImage(seed, width, height) -> Promise<publicUrl>` bound to
 * one Supabase project. [seed] can be any string/number that should
 * deterministically map to a color+image (a username, a keyword, a "lock"
 * counter -- whatever the caller already uses to vary its old third-party
 * URLs).
 */
export function makeLocalMediaFactory({ url, serviceRoleKey, bucket = "posts" }) {
  return async function localImage(seed, width = 900, height = 900) {
    const key = `${seed}:${width}x${height}`;
    if (cache.has(key)) return cache.get(key);

    const hue = hashHue(seed);
    const { r, g, b } = hslToRgb(hue, 0.55, 0.55);
    const buffer = await sharp({
      create: { width, height, channels: 3, background: { r, g, b } },
    })
      .webp({ quality: 70 })
      .toBuffer();

    const path = `seed-fixtures/${crypto.createHash("md5").update(key).digest("hex")}.webp`;
    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "image/webp",
        "x-upsert": "true",
        "cache-control": "31536000, immutable",
      },
      body: buffer,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`local fixture upload failed (${res.status}): ${text}`);
    }

    const publicUrl = `${url}/storage/v1/object/public/${bucket}/${path}`;
    cache.set(key, publicUrl);
    return publicUrl;
  };
}
