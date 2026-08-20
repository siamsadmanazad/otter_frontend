/**
 * HTML meta-tag extraction for POST /api/link/unfurl (feed_genres.md §6.2a).
 * Its own module (not inline in the route) for two reasons: Next.js route
 * files only permit a fixed set of exports (GET/POST/etc. + a few config
 * fields), so anything else defined there is untestable in isolation; and
 * "parse a handful of meta tags out of HTML" is a genuinely separate concern
 * from "handle the request" regardless of that constraint.
 *
 * Hand-rolled scan rather than a full HTML parser dependency -- this only
 * ever needs a handful of <meta> tags out of a page, and pulling in a DOM
 * implementation for that is more than the job calls for.
 */

export interface LinkPreview {
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  image: string | null;
}

/** Tolerant of attribute order (property/name before or after content) and
 * either quote style, since real-world pages are inconsistent about both. */
export function extractMeta(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${escapeRegExp(key)}["'][^>]*content=["']([^"']*)["']|` +
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escapeRegExp(key)}["']`,
      "i"
    );
    const m = html.match(re);
    const value = m?.[1] ?? m?.[2];
    if (value) return decodeHtmlEntities(value.trim());
  }
  return undefined;
}

export function extractTitleTag(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1] ? decodeHtmlEntities(m[1].trim()) : undefined;
}

export function resolveMaybeRelative(url: string | undefined, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

// feed_genres.md Phase 10.1 -- the upstream fetch is capped at 2MB
// (ssrf-guard.ts's MAX_BODY_BYTES), but nothing capped how much of a
// malicious page's <meta> content made it into `posts.link` (jsonb,
// unbounded) before this. A page can put arbitrary bytes in an og:title.
const TITLE_LIMIT = 300;
const DESCRIPTION_LIMIT = 500;

function clip(s: string | undefined, limit: number): string | undefined {
  if (!s) return s;
  return s.length > limit ? s.slice(0, limit).trimEnd() : s;
}

export function buildPreview(html: string, finalUrl: string, domain: string): LinkPreview {
  return {
    url: finalUrl,
    domain,
    title: clip(extractMeta(html, ["og:title", "twitter:title"]) ?? extractTitleTag(html), TITLE_LIMIT) ?? null,
    description:
      clip(extractMeta(html, ["og:description", "twitter:description", "description"]), DESCRIPTION_LIMIT) ?? null,
    image: resolveMaybeRelative(extractMeta(html, ["og:image", "twitter:image"]), finalUrl),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeHtmlEntities(s: string): string {
  return s.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => HTML_ENTITIES[m] ?? m);
}
