import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-edge";

const PROTECTED_PREFIXES = ["/dashboard", "/documents"];

export async function middleware(req: NextRequest) {
  // A real HTTP redirect, not a Server Component redirect() — App Router's
  // redirect() on a statically prerendered page bakes the target into the
  // RSC payload for the client router instead of a Location header, which
  // never fires for a bare HTTP client or before hydration.
  if (req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    req.nextUrl.pathname.startsWith(prefix)
  );
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/documents/:path*"],
};
