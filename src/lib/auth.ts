import { compare, hash } from "bcryptjs";
import type { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth-edge";

type CookieStore = ReturnType<typeof cookies>;

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function getCurrentUser(req: Request) {
  const token = parseCookie(req.headers.get("cookie"), SESSION_COOKIE);
  return loadUserForToken(token);
}

/** For Server Components, which read cookies via next/headers instead of a Request. */
export async function getCurrentUserFromCookieStore(cookieStore: CookieStore) {
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return loadUserForToken(token);
}

async function loadUserForToken(token: string | undefined) {
  const session = await verifySession(token);
  if (!session) return null;

  return prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, username: true },
  });
}

function parseCookie(
  cookieHeader: string | null,
  name: string
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export { SESSION_COOKIE, signSession } from "@/lib/auth-edge";
