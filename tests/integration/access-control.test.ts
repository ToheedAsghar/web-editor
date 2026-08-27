import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/auth-edge";
import { GET } from "@/app/api/documents/[id]/route";

async function makeSessionRequest(documentId: string, userId: string) {
  const token = await signSession(userId);
  return new Request(`http://localhost/api/documents/${documentId}`, {
    headers: { cookie: `session=${token}` },
  });
}

describe("document access control", () => {
  // FK order: Share depends on Document and User; Document depends on User.
  beforeEach(async () => {
    await prisma.share.deleteMany();
    await prisma.document.deleteMany();
    await prisma.user.deleteMany();
  });

  it("returns 403 for an unshared document, then 200 once shared", async () => {
    const userA = await prisma.user.create({
      data: {
        username: "test-owner",
        email: "owner@test.local",
        passwordHash: "unused-in-this-test",
      },
    });
    const userB = await prisma.user.create({
      data: {
        username: "test-other",
        email: "other@test.local",
        passwordHash: "unused-in-this-test",
      },
    });
    const document = await prisma.document.create({
      data: { ownerId: userA.id, title: "Owner's document" },
    });

    const requestBeforeShare = await makeSessionRequest(document.id, userB.id);
    const responseBeforeShare = await GET(requestBeforeShare, {
      params: { id: document.id },
    });
    expect(responseBeforeShare.status).toBe(403);

    await prisma.share.create({
      data: { documentId: document.id, userId: userB.id },
    });

    const requestAfterShare = await makeSessionRequest(document.id, userB.id);
    const responseAfterShare = await GET(requestAfterShare, {
      params: { id: document.id },
    });
    expect(responseAfterShare.status).toBe(200);
    const body = await responseAfterShare.json();
    expect(body.id).toBe(document.id);
  });
});
