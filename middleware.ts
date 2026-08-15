/**
 * Root middleware (replaces the inert app/middleware.ts).
 * - Refreshes the Supabase auth session cookie on each request (@supabase/ssr requirement).
 * - Keeps the legacy behavior: redirect "/" -> "/feed" when authenticated.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated users hitting the marketing root go straight to the feed.
  if (user && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  return response;
}

export const config = {
  // Run on page navigations only — static assets, images, AND /api/* are excluded.
  //
  // /api/* is excluded deliberately (DM speed program, Step A2). This middleware's
  // job is refreshing the *browser's* session cookie for page navigations; every
  // API route already resolves its own caller via getServerUser(). Worse, for the
  // Flutter client the check was pure dead weight: mobile authenticates with an
  // `Authorization: Bearer` header and sends no Supabase cookies, so this
  // cookie-based getUser() could never authenticate it — it only ever added a
  // network round trip to Supabase Auth in front of every single API call.
  // Route Handlers can refresh the cookie session themselves (cookies are
  // writable there), so the web path keeps working without this.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
