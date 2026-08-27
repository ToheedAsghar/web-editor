import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession, verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth-edge";
import { loginSchema } from "@/lib/validation/auth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches the JWT expiry

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const genericError = () =>
    NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return genericError();

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return genericError();

  const token = await signSession(user.id);
  const response = NextResponse.json({
    id: user.id,
    username: user.username,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
