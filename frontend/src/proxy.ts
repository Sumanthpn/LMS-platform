import { NextResponse, type NextRequest } from "next/server";

import { TOKEN_COOKIE } from "@/lib/token";

const PROTECTED = ["/dashboard", "/onboarding", "/exam", "/result"];
const AUTH_ONLY = ["/login", "/signup"];

/**
 * Server-side route protection (Next 16 renamed this convention from middleware): an unauthenticated request for a protected
 * page is redirected before any HTML is rendered, so a guarded page never
 * briefly flashes on screen.
 *
 * This only checks that a token is present. Whether it is valid, and whether
 * the user has completed onboarding, is settled by the API and by AppShell.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (!hasToken && PROTECTED.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed so login can send them back.
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasToken && AUTH_ONLY.some((path) => pathname.startsWith(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/exam/:path*", "/result/:path*", "/login", "/signup"],
};
