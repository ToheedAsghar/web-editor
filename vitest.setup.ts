import { config } from "dotenv";

config();

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set — required so tests run against the " +
      "dedicated test branch, never production."
  );
}

// Every module that constructs a PrismaClient (src/lib/db.ts) reads
// DATABASE_URL at import time. Overriding it here, before any test file or
// route handler is imported, means the app's own Prisma singleton points at
// the test branch for the whole test run — no separate client needed.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
