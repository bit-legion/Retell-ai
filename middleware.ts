import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/signup", "/api/auth", "/create-organization"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Check for session cookie (Better Auth uses session cookie)
  const sessionCookie = request.cookies.get("better-auth.session_token");

  // If accessing a protected route without session, redirect to login
  if (!isPublicRoute && !sessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // If accessing login/signup with session cookie, redirect to dashboard
  // Organization check will be handled at page level
  if ((pathname === "/login" || pathname === "/signup") && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
