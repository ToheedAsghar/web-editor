import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { listDocumentsForUser } from "@/lib/documents";
import { createDocumentSchema } from "@/lib/validation/documents";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owned, shared } = await listDocumentsForUser(user.id);
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
