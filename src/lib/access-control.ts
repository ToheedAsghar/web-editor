import { prisma } from "@/lib/db";

/**
 * Both return `false` uniformly whether the document doesn't exist at all
 * or simply isn't shared with this user — callers must not distinguish
 * these cases in their response (never leak document existence).
 */
async function hasAccess(userId: string, documentId: string): Promise<boolean> {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      OR: [{ ownerId: userId }, { shares: { some: { userId } } }],
    },
    select: { id: true },
  });
  return document !== null;
}

export function canView(userId: string, documentId: string): Promise<boolean> {
  return hasAccess(userId, documentId);
}

export function canEdit(userId: string, documentId: string): Promise<boolean> {
  // Single permission level: any share grants edit access, so this is
  // currently identical to canView. Kept as a separate export because the
  // spec calls for two distinct checks at every call site — if a view-only
  // tier is ever added, only this function changes.
  return hasAccess(userId, documentId);
}

export async function isOwner(userId: string, documentId: string): Promise<boolean> {
  const document = await prisma.document.findFirst({
    where: { id: documentId, ownerId: userId },
    select: { id: true },
  });
  return document !== null;
}
