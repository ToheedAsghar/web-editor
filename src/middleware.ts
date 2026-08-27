import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-edge";

const PROTECTED_PREFIXES = ["/dashboard", "/documents"];

export async function middleware(req: NextRequest) {
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
  matcher: ["/dashboard/:path*", "/documents/:path*"],
};
