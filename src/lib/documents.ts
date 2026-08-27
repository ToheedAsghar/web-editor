import { prisma } from "@/lib/db";

const LIST_SELECT = {
  id: true,
  title: true,
  updatedAt: true,
} as const;

export async function listDocumentsForUser(userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: userId },
      select: LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.document.findMany({
      where: { shares: { some: { userId } } },
      select: LIST_SELECT,
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return { owned, shared };
}
