import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canView, canEdit } from "@/lib/access-control";
import { updateDocumentSchema } from "@/lib/validation/documents";

function forbidden() {
  // Same response whether the document doesn't exist or simply isn't
  // shared with this user — never leak document existence.
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await canView(user.id, params.id))) {
    return forbidden();
  }

  const document = await prisma.document.findUnique({
    where: { id: params.id },
  });
  return NextResponse.json(document);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateDocumentSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (!(await canEdit(user.id, params.id))) {
    return forbidden();
  }

  const { title, content } = parsed.data;
  const document = await prisma.document.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined
        ? { content: content as Prisma.InputJsonValue }
        : {}),
    },
  });
  return NextResponse.json(document);
}
