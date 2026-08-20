/**
 * SSRF guard for any route that fetches a URL a user supplied (currently:
 * POST /api/link/unfurl — feed_genres.md §6.2a, D22). This is the highest-
 * risk new endpoint in that plan: every other new write path only stores
 * structured data a user typed; this one makes an outbound network call on
 * a user's command, from our server, to wherever they point it.
 *
 * The guard blocks the classic "URL resolves to a private/loopback/
 * link-local address" attack (most infamously: the cloud metadata endpoint
 * at 169.254.169.254) AND the DNS-rebinding variant of it — where the
 * hostname resolves to a public IP at check time but a private one at
 * connect time (or on a redirect hop), because a naive guard that checks a
 * hostname and then lets `fetch()` re-resolve it independently has a gap
 * between the two resolutions.
 *
 * The fix is `fetchPinned`: resolve the hostname ourselves, validate every
 * resolved address, then open the actual connection to that validated IP
 * directly (Node's `http`/`https` modules, not the high-level `fetch`,
 * because `fetch` doesn't expose a way to pin the connection target
 * separately from the hostname used for resolution). The original hostname
 * is kept for the `Host` header and TLS SNI (`servername`) so the request
 * still reaches the right virtual host / cert.
 */
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`SSRF_BLOCKED: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

// --- Address classification ------------------------------------------------

/** Big-endian 32-bit integer for an IPv4 address, for CIDR range checks. */
function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inV4Range(ip: string, base: string, prefixLen: number): boolean {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// RFC 1918 private ranges, loopback, link-local (incl. the cloud metadata
// endpoint 169.254.169.254), CGNAT, and the IANA special-purpose/reserved
// blocks that have no business being an unfurl target.
const V4_BLOCKED_RANGES: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
  ["255.255.255.255", 32],
];

function isBlockedV4(ip: string): boolean {
  return V4_BLOCKED_RANGES.some(([base, len]) => inV4Range(ip, base, len));
}

/** Expand an IPv6 address to its 16-byte Buffer for range comparisons. */
function ipv6ToBuffer(ip: string): Buffer {
  // net.isIPv6 already validated the shape; Node has no built-in
  // string->bytes for IPv6, so parse it by hand (handles "::" compression
  // AND the dotted-decimal IPv4-tail form, e.g. "::ffff:169.254.169.254" --
  // caught by the test suite: an earlier version treated the whole
  // "169.254.169.254" as one hex group instead of recognizing it as an
  // embedded IPv4 address, so the mapped-address block below never matched
  // and the metadata endpoint's mapped form sailed straight through).
  const [headPart, tailPart] = ip.split("::");
  const head = headPart ? headPart.split(":") : [];
  const tail = tailPart ? tailPart.split(":") : [];
  // If the last group of the tail is dotted-decimal, expand it into its two
  // 16-bit hex groups before the rest of the parse treats it as one group.
  if (tail.length > 0 && tail[tail.length - 1].includes(".")) {
    const v4 = tail.pop()!;
    const b = v4.split(".").map((p) => parseInt(p, 10));
    tail.push(((b[0] << 8) | b[1]).toString(16), ((b[2] << 8) | b[3]).toString(16));
  }
  const missing = 8 - head.length - tail.length;
  const groups = [...head, ...Array(Math.max(missing, 0)).fill("0"), ...tail];
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 8; i++) {
    const v = parseInt(groups[i] || "0", 16);
    buf.writeUInt16BE(v, i * 2);
  }
  return buf;
}

function isBlockedV6(ip: string): boolean {
  const buf = ipv6ToBuffer(ip);
  // ::1 (loopback)
  if (buf.equals(Buffer.concat([Buffer.alloc(15), Buffer.from([1])]))) return true;
  // :: (unspecified)
  if (buf.equals(Buffer.alloc(16))) return true;
  // ::ffff:0:0/96 (IPv4-mapped) -- extract and re-check the mapped v4.
  if (buf.subarray(0, 10).equals(Buffer.alloc(10)) && buf[10] === 0xff && buf[11] === 0xff) {
    const mapped = `${buf[12]}.${buf[13]}.${buf[14]}.${buf[15]}`;
    return isBlockedV4(mapped);
  }
  // fc00::/7 (unique local / ULA)
  if ((buf[0] & 0xfe) === 0xfc) return true;
  // fe80::/10 (link-local)
  if (buf[0] === 0xfe && (buf[1] & 0xc0) === 0x80) return true;
  // 2001:db8::/32 (documentation)
  if (buf[0] === 0x20 && buf[1] === 0x01 && buf[2] === 0x0d && buf[3] === 0xb8) return true;
  return false;
}

/** True if `ip` must not be connected to. */
export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedV4(ip);
  if (net.isIPv6(ip)) return isBlockedV6(ip);
  return true; // unrecognized shape -- fail closed
}

// --- Resolve + validate ------------------------------------------------

/**
 * Resolves `hostname`'s A/AAAA records and throws if ANY of them (not just
 * the first) is a blocked address -- a hostname that round-robins between a
 * decoy public IP and a private one must not sneak through on a lucky draw.
 * Returns the first non-blocked address to connect to.
 */
async function resolveAndValidate(hostname: string): Promise<string> {
  // A literal IP in the URL skips DNS entirely -- validate it directly.
  if (net.isIP(hostname)) {
    if (isBlockedAddress(hostname)) {
      throw new SsrfBlockedError(`literal address ${hostname} is not allowed`);
    }
    return hostname;
  }
  let records;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SsrfBlockedError(`could not resolve ${hostname}`);
  }
  if (records.length === 0) throw new SsrfBlockedError(`${hostname} has no addresses`);
  for (const r of records) {
    if (isBlockedAddress(r.address)) {
      throw new SsrfBlockedError(`${hostname} resolves to a blocked address (${r.address})`);
    }
  }
  return records[0].address;
}

// --- The pinned fetch ------------------------------------------------

export interface PinnedFetchResult {
  finalUrl: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 5000;

type Requester = (
  target: URL,
  ip: string
) => Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>;

/**
 * Fetches `startUrl`, resolving and validating the address at EVERY hop
 * (redirects included) and connecting to the validated IP directly rather
 * than letting the HTTP client re-resolve the hostname -- see the module
 * doc comment for why that gap matters. Never follows a redirect
 * automatically; each one is a fresh resolve-validate-connect cycle.
 *
 * [requester] is an injection seam for tests only (defaults to the real
 * network transport) -- it exists because no public redirect-testing
 * service will actually issue a redirect to a private/link-local address
 * for you to test against (they block it themselves, which is reassuring
 * but leaves no live third party to verify the per-hop revalidation
 * against). Swapping just the transport keeps the resolve-validate loop
 * itself -- the part that matters -- under real test, deterministically.
 */
export async function fetchPinned(
  startUrl: string,
  requester: Requester = requestOnce
): Promise<PinnedFetchResult> {
  let current = new URL(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "http:" && current.protocol !== "https:") {
      throw new SsrfBlockedError(`unsupported scheme ${current.protocol}`);
    }
    // Re-run for every hop, including redirects -- this is the whole point
    // of the loop living here rather than handing "follow redirects" off
    // to a lower-level client that would only validate the first request.
    const ip = await resolveAndValidate(current.hostname);
    const result = await requester(current, ip);
    if (result.status >= 300 && result.status < 400 && result.headers.location) {
      current = new URL(result.headers.location, current);
      continue;
    }
    return { ...result, finalUrl: current.toString() };
  }
  throw new SsrfBlockedError("too many redirects");
}

function requestOnce(
  target: URL,
  ip: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const transport = target.protocol === "https:" ? https : http;
    const req = transport.request(
      {
        // Pinned: connect to the address we already validated, not to
        // `target.hostname` again (that would re-resolve and reopen the gap).
        host: ip,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: "GET",
        // Host header + TLS SNI still use the real hostname, so the origin
        // serves the right virtual host / presents the right certificate.
        headers: { Host: target.hostname, "User-Agent": "TripOtterLinkPreview/1.0" },
        servername: target.protocol === "https:" ? target.hostname : undefined,
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BODY_BYTES) {
            req.destroy();
            reject(new SsrfBlockedError("response exceeded the size cap"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new SsrfBlockedError("request timed out"));
    });
    req.on("error", reject);
    req.end();
  });
}
