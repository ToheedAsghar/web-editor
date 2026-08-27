# Spec: Collaborative Document Editor (take-home assignment)

## Objective

Build a lightweight, Google-Docs-inspired collaborative document editor as a
timeboxed take-home submission, graded on product judgment, deliberate scope
cuts, and communication as much as on code. **Budget: ~4h55m total, all-in —
code, tests, deployment, and every non-code deliverable (README, architecture
note, AI-workflow note, SUBMISSION.md, walkthrough video).** (A 2-hour
all-in budget was proposed and shown not to fit the protected scope even at
the floor — see `tasks/plan.md`'s Budget Reconciliation for that arithmetic —
and the budget was then extended to match the honest cost of the protected
feature set rather than cutting further into it.)

**User:** a single person creating and editing rich-text documents, optionally
sharing edit access with named collaborators. No real-time co-presence is
required — "collaborative" here means shared ownership and edit rights, not
simultaneous live editing.

**Success looks like:** a deployed, working link where a reviewer can sign in
with a seeded account, create/edit a document with rich formatting, upload a
`.md` file as a new document, share a document with another seeded user by
username, and confirm that a third, unshared user is denied access. The
sharing/access-control path is backed by an automated test, not just manual
verification. Critically, the seeded credentials must actually work against
the **deployed** database, not just locally.

**Explicit non-goals** (see Scope — Out): real-time collaboration/CRDTs,
comments/suggestions/version history, PDF export, role-based permissions,
non-markdown import, object storage, Redis/queues/caching/Docker, email
verification/password reset/OAuth, login rate limiting, **signup** (login +
logout only, against seeded accounts — the brief explicitly permits this),
and **document delete** (not in the brief's listed CRUD verbs; cut under the
2-hour budget). If a reviewer expects one of these, the README's "Scope Cuts"
section is the intended answer, not silent omission.

## Tech Stack

- Next.js 14+ (App Router, TypeScript) — single deployable unit
- Neon Postgres — **pooled** connection string (`DATABASE_URL`) for app
  runtime, **direct/unpooled** connection string (`DIRECT_URL`) for Prisma
  migrations (Prisma migrations fail against Neon's pooled connection — this
  is not an assumption, both are required); a second Neon branch for tests
  (`TEST_DATABASE_URL`)
- Prisma ORM
- TipTap (ProseMirror) — `StarterKit` + `@tiptap/extension-underline`
- Tailwind CSS (minimal styling only under the 2-hour budget — functional,
  not polished; plain-text toolbar buttons, unstyled lists)
- Vitest
- Auth: `bcryptjs` (password hashing) + `jose` (JWT, edge-compatible) in an
  httpOnly + secure + `sameSite=lax` cookie. Split into two functions
  (Next middleware runs on the edge runtime and cannot touch Prisma):
  - `verifySession(token)` — edge-safe, `jose` only, no database. Used by
    `middleware.ts` to decide redirect-or-pass.
  - `getCurrentUser(req)` — Node runtime, verifies the token **and** loads
    the user from the database. Used by route handlers.
  Middleware calls only `verifySession`, never `getCurrentUser`.
- Deployed on Vercel
- `marked` — markdown → HTML, for the `.md` import feature (approved)

**Markdown-import path — decided, client-side only:** TipTap's `generateJSON`
needs a `document`-like object to parse the HTML `marked` produces. A
server-side DOM shim (`zeed-dom`/`jsdom`) was the original plan, timeboxed to
20 minutes with a client-side fallback. Under the 2-hour budget, that
timebox itself is no longer affordable, so **the server-side attempt is
skipped entirely** — go straight to the fallback: read the uploaded file in
the browser, run `marked` → `generateJSON` there (a real browser DOM, no shim
needed), then POST the resulting ProseMirror JSON to the existing
document-create endpoint. The server still validates the JSON shape with Zod.
This is a deliberate choice to eliminate the single biggest technical
unknown in the build, not a fallback discovered by failure — record it that
way in the README's AI-workflow note.

## Data Model

Given, unchanged from the brief. `Share`'s `@@unique([documentId, userId])`
is relied upon directly: see Sharing Edge Cases below.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // pooled — app runtime
  directUrl = env("DIRECT_URL")   // unpooled — migrations only
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  documents Document[] @relation("OwnedDocuments")
  shares    Share[]
}

model Document {
  id        String   @id @default(cuid())
  title     String   @default("Untitled document")
  content   Json     @default("{\"type\":\"doc\",\"content\":[]}")
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner  User    @relation("OwnedDocuments", fields: [ownerId], references: [id], onDelete: Cascade)
  shares Share[]

  @@index([ownerId])
}

model Share {
  id         String   @id @default(cuid())
  documentId String
  userId     String
  createdAt  DateTime @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([documentId, userId])
  @@index([userId])
}
```

## Commands

```
Dev:            npm run dev
Build:          npm run build              # includes `prisma generate`
Migrate (dev):  npx prisma migrate dev
Migrate (prod): npx prisma migrate deploy
Seed:           npx prisma db seed
Test:           npm test                   # vitest run, against TEST_DATABASE_URL
Test (watch):   npm run test:watch
Lint:           npm run lint
Typecheck:      npm run typecheck           # tsc --noEmit
```

## Project Structure

```
prisma/
  schema.prisma        → data model (given)
  seed.ts               → idempotent seed: 2–3 users, ≥1 sample document,
                           ≥1 existing share between seeded users (so
                           "Shared with me" is populated on first login)

src/
  app/
    (auth)/login/page.tsx           → no signup page — login only, seeded accounts
    (app)/dashboard/page.tsx        → "My documents" / "Shared with me"
    (app)/documents/[id]/page.tsx   → editor page (title + TipTap + save status)
    api/
      auth/login/route.ts
      auth/logout/route.ts
      documents/route.ts            → GET (list), POST (create — also the
                                        target for client-side markdown import)
      documents/[id]/route.ts       → GET, PATCH ({title?, content?}) — no DELETE
      documents/[id]/shares/route.ts → POST (share by username), GET (list shares)
      documents/[id]/shares/[shareId]/route.ts → DELETE (revoke, owner-only)
  lib/
    db.ts               → Prisma client singleton
    auth.ts             → verifySession() (edge-safe) + getCurrentUser() (Node+DB),
                           JWT sign (7-day, non-refreshing), password hashing
    access-control.ts   → canView(userId, docId), canEdit(userId, docId)
    validation/          → Zod schemas per route
  middleware.ts          → calls verifySession() only; redirects unauthenticated
                           requests to /login; never touches Prisma

tests/
  integration/access-control.test.ts   → the required sharing/403 proof test;
                                          imports route handlers directly,
                                          mints a real JWT via signSession()
                                          and attaches it as a cookie header
                                          on a constructed `Request`; runs
                                          against TEST_DATABASE_URL with a
                                          beforeEach that truncates Share,
                                          Document, then User (FK order) so
                                          reruns don't collide on @unique
                                          constraints — no dev server, no
                                          HTTP round trip
```

**Signup is out of scope** (login + logout only, against seeded accounts —
the brief explicitly permits this). **Document delete is out of scope** (not
in the brief's listed CRUD verbs — create, rename, edit, list, open — and cut
under the 2-hour budget). Both are documented as deliberate scope cuts in the
README, not omissions.

## Code Style

Every document route handler follows the same order: `getCurrentUser` → Zod
parse → `canEdit`/`canView` → Prisma call → typed response.

```ts
// src/app/api/documents/[id]/route.ts
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = updateDocumentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (!(await canEdit(user.id, params.id))) {
    // Same response whether the doc doesn't exist or simply isn't shared with
    // this user — never leak existence.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.document.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json(doc);
}
```

Conventions:
- Named exports only; no default exports for route handlers or lib functions.
- Async/await throughout, no `.then` chains.
- Zod schemas live in `src/lib/validation/`, one file per resource, imported
  by route handlers — never inlined ad hoc.
- `canView`/`canEdit` are the *only* authorization checks. No route handler
  re-implements ownership/share logic inline.
- Client components only where interactivity requires it (editor, forms,
  markdown-upload widget if the client-side conversion path is used);
  everything else is a server component.
- Known Prisma error codes are caught and mapped to specific messages, never
  left to surface as a raw 500 (see Sharing Edge Cases).

## Sharing Edge Cases

All three must return a clear, specific error — never a silent no-op and
never an unhandled 500:

- **Username does not exist** → literal `404` with a "no such user" message.
  This is about *username* existence for the owner's own sharing action, not
  document existence — it does not conflict with the "never leak document
  existence" rule, which applies only to `canView`/`canEdit` checks on the
  document itself.
- **Sharing with yourself** → rejected with a specific "cannot share with
  yourself" message, checked before hitting the database.
- **Re-sharing to a user who already has access** → the
  `@@unique([documentId, userId])` constraint on `Share` throws Prisma error
  `P2002` on the `create`. Catch it specifically and return "already shared
  with this user" — do not let it surface as an unhandled 500.

## Upload Validation

`.md` only, enforced two ways, not one:

1. Filename extension check (rejects obviously-wrong files fast).
2. Content check — the file body must decode as valid UTF-8 text before it's
   handed to `marked`. An extension is a filename, not a guarantee; a binary
   file renamed to `.md` must still be rejected with a clear error.

**Size cap: 1MB.** Generous for markdown, and an explicit, stated limit
closes the "unbounded multipart into a serverless function" gap a reviewer
would otherwise flag. Oversized files are rejected with a specific error
before parsing is attempted.

## Testing Strategy

- **Framework:** Vitest.
- **Required test (the load-bearing one):**
  `tests/integration/access-control.test.ts`. Runs against a real Postgres
  database on a dedicated Neon branch (`TEST_DATABASE_URL`) — a mocked Prisma
  client was considered and rejected because it can't prove the
  `@@unique([documentId, userId])` constraint or the real `canView`/`canEdit`
  query path actually work, which is the entire point of this test per the
  brief.
- **Execution model:** import the route handlers directly and invoke them
  with constructed `Request` objects. No Next dev server is spun up for
  tests — no server lifecycle to manage, faster to write, fast enough to run
  on every save. Sessions are minted directly with `signSession()` from the
  auth lib and attached as a cookie header on the constructed `Request` —
  there is no signup route to create a session through.
- **Test isolation:** a `beforeEach` truncates `Share`, `Document`, then
  `User` (in that order, to respect foreign keys) on `TEST_DATABASE_URL`.
  Without this, the second test run collides with the first on `@unique`
  email/username constraints.
- **Test flow:** user A and user B created directly via Prisma, user A
  creates a document, assert user B's GET on that document → `403`. Create a
  `Share` row directly (or call the share endpoint), assert user B's GET on
  the same document → `200`.
- **Explicitly dropped from the initial build:** unit tests for
  `canView`/`canEdit` in isolation, and for the markdown-conversion function.
  The integration test covers the load-bearing path; these were judged not to
  add enough marginal proof to be worth the time. **If time remains at the
  end,** the markdown-conversion test is the more useful of the two to add —
  but documentation and the walkthrough video take priority over any optional
  test. Do not let optional tests displace those.

## Boundaries

- **Always:** run `npm test` and `npm run typecheck` before calling a task
  done; call `canView`/`canEdit` in every document route handler; validate
  every API input with Zod; use the data model exactly as given; keep
  everything in Scope — Out unbuilt unless the human says otherwise; catch
  known Prisma error codes (e.g. `P2002`) rather than letting them 500.
- **Ask first:** any dependency not already named; any change to the Prisma
  schema; any deviation from the given cookie/JWT approach; calling Prisma
  from `middleware.ts` (it must stay edge-safe via `verifySession` only).
- **Never:** use Auth.js/NextAuth; store editor content as HTML instead of
  ProseMirror JSON; trust a client-supplied permission flag; return 404 (vs
  403) to signal "you can't view this document"; build anything in Scope —
  Out, including login rate limiting, signup, or document delete; use object
  storage for the markdown upload; attempt the server-side DOM-shim markdown
  path (deliberately skipped, not deferred); silently add mitigations for the
  accepted last-write-wins risk (below) without being asked.

## Success Criteria

1. A visitor hitting any `/dashboard` or `/documents/*` route while logged
   out is redirected to `/login`.
2. Seeded users can log in and log out. (No signup — seeded accounts only,
   a deliberate cut under the 2-hour budget.)
3. A logged-in user can create a document, see it in "My documents", rename
   it, and edit rich text (bold/italic/underline/headings/bulleted+numbered
   lists). No delete (deliberate cut). Changes auto-save ~800ms after the
   last keystroke with a visible "Saving…" → "Saved" indicator, via a single
   `PATCH /api/documents/:id` accepting `{ title?, content? }`.
4. Reloading a document shows the persisted ProseMirror JSON rendered
   correctly — not HTML, not a lossy round-trip of the formatting used in (3).
5. Uploading a `.md` file creates a new document whose content matches the
   source structurally (headings, lists, bold/italic); underline is known and
   documented not to round-trip. A non-`.md` extension, a binary file renamed
   to `.md`, and a file over 1MB are each rejected with a specific, clear
   error — not a silent failure and not a generic one.
6. Owner can share a document by username; the target user sees it under
   "Shared with me" and can edit it. Owner can revoke the share, after which
   the target user immediately loses access (next request returns 403).
   Sharing with a nonexistent username, sharing with yourself, and re-sharing
   to an already-shared user each produce a specific, clear error rather than
   a silent no-op or a 500.
7. `tests/integration/access-control.test.ts` runs against a real Postgres
   database (a dedicated Neon test branch), invokes route handlers directly
   without a dev server, and demonstrably fails if the share check is removed
   (i.e., it's a real assertion, not a tautology).
8. **The deployed production database is migrated and seeded** —
   `prisma migrate deploy` and `prisma db seed` run against the production
   Neon branch after deploy — **and this is verified by logging in as a
   seeded user on the live Vercel URL in an incognito window.** This is a
   success criterion, not a cleanup step: a live link with no working
   credentials is a dead-on-arrival submission.
9. The full flow (create → edit → upload → share → verify 403/200 → revoke)
   can be walked by a reviewer on the live URL with zero local setup.
10. README documents: seeded user credentials, the scope cuts and why
    (including signup and document delete, cut under the 2-hour budget), the
    deliberate choice of the client-side markdown-import path as an
    AI-workflow note, and the Known Limitations below.

## Known Limitations (to document verbatim in README, not to mitigate)

- **No login rate limiting.** Accepted gap — Redis/queues are explicitly out
  of scope for this timebox. Not to be silently added later.
- **Last-write-wins on concurrent edits.** Two users with edit access on the
  same shared document, editing at the same time, will silently overwrite
  each other on autosave — no merge, no conflict warning. This follows
  directly from real-time collaboration being out of scope. It is a known,
  named risk, not a bug discovered later.
- **Underline does not round-trip through markdown import.** Markdown has no
  native underline syntax; a `.md` file can't express it, so imported
  documents never contain underlined text even if the original intent was
  there.

## Open Questions

None outstanding. The 2-hour-budget-vs-protected-scope conflict raised during
planning is resolved: the budget was extended to ~4h55m to match the honest
cost of the full protected feature set, rather than cutting further into
access control, the integration test, sharing edge cases, upload validation,
or Phase 7. See `tasks/plan.md` for the full reconciliation record.
