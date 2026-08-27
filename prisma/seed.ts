import { PrismaClient, Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "password123";
const BCRYPT_ROUNDS = 10;

const SEED_USERS = [
  { username: "alice", email: "alice@example.com" },
  { username: "bob", email: "bob@example.com" },
  { username: "carol", email: "carol@example.com" },
];

const SAMPLE_DOCUMENT_TITLE = "Welcome";
const SAMPLE_DOCUMENT_CONTENT: Prisma.InputJsonValue = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Welcome" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This is a sample document seeded for review. It has some " },
        { type: "text", text: "bold", marks: [{ type: "bold" }] },
        { type: "text", text: " and " },
        { type: "text", text: "italic", marks: [{ type: "italic" }] },
        { type: "text", text: " text." },
      ],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Shared with bob for edit access" }],
            },
          ],
        },
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Try editing this document" }],
            },
          ],
        },
      ],
    },
  ],
};

async function main() {
  const passwordHash = await hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  const users = await Promise.all(
    SEED_USERS.map((u) =>
      prisma.user.upsert({
        where: { username: u.username },
        update: {},
        create: { ...u, passwordHash },
      })
    )
  );

  const [alice, bob] = users;

  let doc = await prisma.document.findFirst({
    where: { title: SAMPLE_DOCUMENT_TITLE, ownerId: alice.id },
  });
  if (!doc) {
    doc = await prisma.document.create({
      data: {
        title: SAMPLE_DOCUMENT_TITLE,
        content: SAMPLE_DOCUMENT_CONTENT,
        ownerId: alice.id,
      },
    });
  }

  await prisma.share.upsert({
    where: { documentId_userId: { documentId: doc.id, userId: bob.id } },
    update: {},
    create: { documentId: doc.id, userId: bob.id },
  });

  console.log(
    `Seeded ${users.length} users (password: "${SEED_PASSWORD}" for all), 1 document, 1 share.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
