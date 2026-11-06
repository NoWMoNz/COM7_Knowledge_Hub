import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic gate only: refreshes the session and redirects anonymous users.
// Real authorization happens in server code (requirePermission) and RLS.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth/callback"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims() verifies the JWT signature locally against the project's (cached) JWKS, so this gate costs no
  // network round trip on every request/prefetch. It still refreshes an expired session (cookies via setAll).
  // The authoritative check stays in server code: getCurrentUser() validates with Supabase Auth, then RLS applies.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (signedIn && (pathname === "/login" || pathname === "/forgot-password")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return response;
}

export const config = {
  // /api is excluded: route handlers authenticate themselves (401 JSON, not a redirect) and large uploads skip proxy buffering.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
