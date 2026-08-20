import { NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth/server";
import { ok, fail } from "@/lib/api/http";
import { enforceRateLimit } from "@/lib/ratelimit";
import { fetchPinned, SsrfBlockedError } from "@/lib/api/ssrf-guard";
import { buildPreview } from "@/lib/api/unfurl-meta";

// POST /api/link/unfurl  body { url } -> { url, domain, title, description, image }
//
// feed_genres.md §6.2a — the composer calls this BEFORE creating a Post to
// preview a link enrichment; the resulting object is what gets sent as
// `link` on POST /api/posts. Deliberately its own step rather than folded
// into post creation: an unreachable/slow link should never block or fail
// the post itself, and the preview needs to render before the user commits.
//
// This is the highest-risk new route in the plan (see ssrf-guard.ts's doc
// comment) -- every network-safety guard lives in fetchPinned, not here;
// this handler's job is auth, rate limiting, and turning the fetched bytes
// into a preview (that part lives in unfurl-meta.ts, testable on its own).
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await getServerUser(request);
    if (!user) return fail("Unauthorized", 401);

    // Modest limit: this is composer tooling (a handful of link pastes per
    // session), not a general-purpose fetch proxy.
    const limited = await enforceRateLimit("link_unfurl", user.id, request, 15, 60);
    if (limited) return limited;

    const body = await request.json();
    const rawUrl: string | undefined = body.url;
    if (!rawUrl?.trim()) return fail("A URL is required", 400);

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return fail("That doesn't look like a valid URL", 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return fail("Only http/https links are supported", 400);
    }

    let result;
    try {
      result = await fetchPinned(parsed.toString());
    } catch (e) {
      if (e instanceof SsrfBlockedError) {
        // Deliberately vague to the client: "couldn't load" is
        // indistinguishable from "we refused to load it", which is the
        // point -- no reason to teach a caller which private ranges we
        // block or how our guard decides that.
        return fail("Couldn't load a preview for that link", 422);
      }
      throw e;
    }

    if (result.status < 200 || result.status >= 300) {
      return fail("Couldn't load a preview for that link", 422);
    }

    const domain = new URL(result.finalUrl).hostname;
    const contentType = String(result.headers["content-type"] ?? "");

    if (contentType.startsWith("image/")) {
      return ok(
        { url: result.finalUrl, domain, title: null, description: null, image: result.finalUrl },
        "Preview loaded"
      );
    }

    const preview = buildPreview(result.body.toString("utf8"), result.finalUrl, domain);
    return ok(preview, "Preview loaded");
  } catch (e) {
    console.error("POST /api/link/unfurl error:", e);
    return fail("Internal server error", 500);
  }
}
