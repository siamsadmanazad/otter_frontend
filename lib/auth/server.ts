/**
 * Server-side auth helpers for Route Handlers / Server Components.
 * Replaces getServerSession(authOptions). Used by the rebuilt app/api routes (data seam).
 *
 * getServerUser(): resolves the caller from the Supabase cookie session OR an
 * `Authorization: Bearer <access_token>` header (so the Flutter client uses the same routes).
 * Returns the caller's profile id + email, or null.
 */
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export interface ServerUser {
  /**
   * The authenticated **human** (`auth.users.id`).
   *
   * Use for anything that must not be multiplied by switching profiles:
   * rate limiting, abuse controls, billing. A person with three business
   * profiles still gets one rate budget.
   */
  id: string;
  /**
   * The **profile the request is acting as** — use for ownership and
   * authorship: who owns a row, who authored a post, whose settings these are.
   *
   * This is the route-layer twin of the database's `current_profile_id()`
   * (migration `20260826120000_current_profile_id_seam.sql`). RLS only covers
   * the ~38 routes on the user-scoped client; the ~31 routes on the
   * service-role client bypass RLS entirely, so their handler logic is the only
   * gate — this field is that gate's input.
   *
   * **Inert today: always identical to `id`.** When Business Mode profile
   * switching lands (business_mode.md 0.2) only the resolver below changes, to
   * prefer a validated `acting_profile` claim. Call sites never move again.
   */
  profileId: string;
  email: string | null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** The `iss` every access token from THIS project must carry. */
const EXPECTED_ISSUER = `${SUPABASE_URL}/auth/v1`;

/**
 * Module-scoped verifier client, reused across requests **on purpose**.
 *
 * auth-js caches the project's JWKS on the client *instance* for 10 minutes
 * (JWKS_TTL). A per-request client would therefore refetch the key set on every
 * single call and defeat the whole point of local verification — swapping one
 * network round trip for another. A warm serverless invocation reuses this
 * instance, so the common path touches no network at all.
 *
 * Safe to share: getClaims() is always called with an explicit JWT, so it never
 * reads or mutates session state — it only reads/writes the JWKS cache, where a
 * concurrent race costs at most one duplicate fetch of a public key set.
 */
let verifier: SupabaseClient | null = null;
function getVerifier(): SupabaseClient {
  verifier ??= createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return verifier;
}

/**
 * Resolve a Bearer access token to a user, verifying the JWT **locally**.
 *
 * This project signs access tokens with ES256 and publishes the public key at
 * /auth/v1/.well-known/jwks.json, so the signature can be checked with WebCrypto
 * instead of asking the Auth server to do it. getUser() cost a full round trip on
 * every single API call — and under the 4-way fan-out that opening a DM thread
 * produces, that contention measured 1.7-3.5s per request (dm_redesign.md §7 A1).
 *
 * Security notes — getClaims() (auth-js 2.108.2) already:
 *   - rejects a missing/expired `exp`,
 *   - permits only RS256/ES256 (so `alg: none` and HS-confusion both throw),
 *   - verifies the signature via crypto.subtle against the JWKS key for `kid`,
 *   - falls back to a remote getUser() whenever it *cannot* verify locally —
 *     an HS256 token, or a `kid` absent from our JWKS (e.g. a token minted by a
 *     different Supabase project). That fallback fails closed for a bad token.
 *
 * The issuer/role/sub checks below are defence in depth: cheap, and they make the
 * trust boundary explicit here rather than implicit in a dependency's internals.
 *
 * TRADE-OFF, deliberate: local verification cannot see server-side revocation, so
 * a signed-out or banned user stays valid until their token expires (this project:
 * 1h TTL, confirmed against a live token). Blocks are enforced per-query in the
 * chat routes rather than at the session layer, so this does not weaken them.
 */
async function userFromBearerToken(token: string): Promise<ServerUser | null> {
  const { data, error } = await getVerifier().auth.getClaims(token);
  if (error || !data?.claims) return null;

  const claims = data.claims as Record<string, unknown>;
  if (claims.iss !== EXPECTED_ISSUER) return null;
  // Never let an anon/service-role token authenticate as an end user.
  if (claims.role !== "authenticated") return null;
  const sub = claims.sub;
  if (typeof sub !== "string" || !sub) return null;

  const email = typeof claims.email === "string" ? claims.email : null;
  return { id: sub, profileId: actingProfileFrom(claims, sub), email };
}

/**
 * The acting profile carried by a verified token, else the caller's own id.
 *
 * `acting_profile` is stamped by the `custom_access_token_hook` Postgres
 * function at mint time, which re-checks business_members before stamping —
 * so by the time it reaches here it is already validated and signed. We do not
 * re-authorize it: that is the whole reason the DB seam is a scalar
 * (`current_profile_id()`) rather than a per-row capability check.
 *
 * Only trust this off a token whose signature has already been verified.
 */
function actingProfileFrom(claims: Record<string, unknown>, fallback: string): string {
  const acting = claims.acting_profile;
  return typeof acting === "string" && acting ? acting : fallback;
}

export async function getServerUser(req?: Request): Promise<ServerUser | null> {
  // 1) Bearer token (mobile / non-cookie clients)
  const authz = req?.headers.get("authorization") ?? req?.headers.get("Authorization");
  if (authz?.startsWith("Bearer ")) {
    return userFromBearerToken(authz.slice(7));
  }

  // 2) Cookie session (web).
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  // getUser() returns the user record, which does NOT carry custom claims — so
  // read acting_profile off the session's access token. Verified locally via the
  // same JWKS path as the Bearer branch; on any doubt we fall back to the user's
  // own id, which is the safe direction (their own profile, never someone else's).
  let profileId = data.user.id;
  try {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    if (token) {
      const { data: c, error: cErr } = await getVerifier().auth.getClaims(token);
      const claims = c?.claims as Record<string, unknown> | undefined;
      if (!cErr && claims && claims.iss === EXPECTED_ISSUER && claims.sub === data.user.id) {
        profileId = actingProfileFrom(claims, data.user.id);
      }
    }
  } catch {
    // keep the fallback
  }

  return { id: data.user.id, profileId, email: data.user.email ?? null };
}
