import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createDocumentSchema } from "@/lib/validation/documents";

const LIST_SELECT = {
  id: true,
  title: true,
  updatedAt: true,
} as const;

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [owned, shared] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: user.id },
      select: LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.document.findMany({
      where: { shares: { some: { userId: user.id } } },
      select: LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ owned, shared });
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createDocumentSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { title, content } = parsed.data;
  const document = await prisma.document.create({
    data: {
      ownerId: user.id,
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined
        ? { content: content as Prisma.InputJsonValue }
        : {}),
    },
  });

  return NextResponse.json(document, { status: 201 });
}
