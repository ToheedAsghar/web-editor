# Task List: Collaborative Document Editor (~4h55m, all-in budget)

Phase-level summary and time budget: [`plan.md`](plan.md). Budget was
extended from an original 2-hour ask to match the honest cost of the
protected scope — see plan.md's Budget Reconciliation for that history. This
checklist reflects the full protected scope as specced and is ready to
implement.

---

## Phase 1: Foundation & Deployment

### Task 1: Scaffold Next.js project
**Description:** Initialize Next.js (App Router, TypeScript) with Tailwind. Repo initialized, `.gitignore` covers `.env*`/`node_modules`/`.next`.
**Acceptance criteria:**
- [ ] `npm run dev` serves a default page
- [ ] `.env.example` lists `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL`, `JWT_SECRET`
**Verification:** `npm run build` succeeds; manual page load.
**Dependencies:** None
**Files:** scaffolded + `.env.example`, `.gitignore`
**Est. time:** 10m

### Task 2: Deploy bare scaffold
**Description:** Connect the repo to Vercel and deploy the untouched scaffold — an empty default page. Purpose is solely to catch build/env-var/`prisma generate`-in-build-step failures in the first 20 minutes, not to ship anything functional.
**Acceptance criteria:**
- [ ] Vercel build succeeds on the bare scaffold
- [ ] A placeholder `prisma generate` step in the build command runs without error (schema can be a stub at this point)
**Verification:** Visit the live URL, see the default page.
**Dependencies:** Task 1
**Files:** Vercel project config
**Est. time:** 10m

### Task 3: Prisma schema + Neon branches + migration
**Description:** Add the schema from SPEC.md verbatim, including the `datasource` block with both `url` (`DATABASE_URL`, pooled) and `directUrl` (`DIRECT_URL`, unpooled). Provision a Neon production branch and a separate Neon branch for `TEST_DATABASE_URL`. Migrate both.
**Acceptance criteria:**
- [ ] `prisma/schema.prisma` matches SPEC.md exactly, including `directUrl`
- [ ] `npx prisma migrate dev` (or `deploy`) succeeds against the prod branch using `DIRECT_URL`
- [ ] Same migration applied to the test branch
- [ ] Prisma client singleton in `src/lib/db.ts`
**Verification:** Inspect both branches (Prisma Studio or `psql`) — three empty tables on each.
**Dependencies:** Task 2
**Files:** `prisma/schema.prisma`, `src/lib/db.ts`, `.env`
**Est. time:** 12m

### Task 4: Auth library, split for edge safety
**Description:** `bcryptjs` hash/compare. Two auth entry points, not one:
- `verifySession(token)` — `jose`-only, no Prisma import anywhere in its module graph. This is what `middleware.ts` calls.
- `getCurrentUser(req)` — Node runtime, calls `verifySession` then loads the user from Prisma. This is what route handlers call.
**Acceptance criteria:**
- [ ] `verifySession` has zero transitive imports of `src/lib/db.ts` or `@prisma/client`
- [ ] `getCurrentUser` returns `null` (not throw) on missing/invalid/expired token
- [ ] JWT expiry is 7 days, non-refreshing
**Verification:** Manual — sign a token, verify it, tamper with it, confirm verify fails; grep confirms no Prisma import in the `verifySession` module.
**Dependencies:** Task 1
**Files:** `src/lib/auth.ts` (or split into `auth-edge.ts` + `auth.ts` if that's cleaner)
**Est. time:** 15m

### Task 5: Login / logout routes
**Description:** `POST /api/auth/login`, `POST /api/auth/logout`. No signup route. Zod validation on login input. Login sets the session cookie via `getCurrentUser`'s underlying sign function; logout clears it.
**Acceptance criteria:**
- [ ] Login rejects wrong password / unknown user with the same generic message
- [ ] Logout clears the cookie
**Verification:** Manual via curl/Postman against a seeded user (seed doesn't exist yet at this point — stub a user directly in the DB for this check, or defer full verification to Task 9).
**Dependencies:** Task 3, Task 4
**Files:** `src/app/api/auth/login/route.ts`, `.../logout/route.ts`, `src/lib/validation/auth.ts`
**Est. time:** 10m

### Task 6: Auth middleware
**Description:** `middleware.ts` calls `verifySession` only — never `getCurrentUser`, never imports anything that touches Prisma. Redirects unauthenticated requests to `/login` for `/dashboard` and `/documents/*`.
**Acceptance criteria:**
- [ ] Logged-out visit to `/dashboard` redirects to `/login`
- [ ] Logged-in visit passes through
- [ ] `middleware.ts`'s import graph contains no Prisma
**Verification:** Manual check with/without session cookie; grep for `@prisma/client` in `middleware.ts`'s imports.
**Dependencies:** Task 4
**Files:** `middleware.ts`
**Est. time:** 5m

### Task 7: Minimal login page + dashboard shell
**Description:** Functional login form. Dashboard page shows "logged in as {username}" and a logout button. No signup page. No document list yet.
**Acceptance criteria:**
- [ ] Login form posts to the login route, redirects to `/dashboard` on success, shows an error on failure
- [ ] Dashboard shows current user and a working logout button
**Verification:** Manual login → dashboard → logout loop.
**Dependencies:** Task 5, Task 6
**Files:** `src/app/(auth)/login/page.tsx`, `src/app/(app)/dashboard/page.tsx`
**Est. time:** 10m

### Task 8: Seed script
**Description:** Idempotent (`upsert`-based) seed: 2–3 users, one sample document, one existing `Share` row so the second seeded user sees "Shared with me" populated immediately.
**Acceptance criteria:**
- [ ] Running the seed twice does not error or duplicate rows
- [ ] Seeded credentials will be documented in Task 22 (README)
**Verification:** `npx prisma db seed` runs clean twice in a row.
**Dependencies:** Task 3
**Files:** `prisma/seed.ts`
**Est. time:** 10m

### Task 9 — CHECKPOINT: Production migrate, seed, and live login
**Description:** Run `prisma migrate deploy` and `prisma db seed` against the **production** Neon branch (using `DIRECT_URL` for the migration step, `DATABASE_URL` for the app's runtime queries). Set `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` as Vercel production env vars. Redeploy with the real app. Log in as a seeded user on the live URL in an incognito window.
**Acceptance criteria:**
- [ ] Vercel build succeeds with the real app (not the bare scaffold from Task 2)
- [ ] Production database has the migrated schema and seeded rows
- [ ] Login succeeds on the live URL, incognito — this satisfies Success Criterion #8
**Verification:** Manual, incognito, live URL.
**Dependencies:** Tasks 1–8
**Files:** Vercel env var settings
**Est. time:** 10m
**Do not proceed to Phase 2 until this passes.**

---

## Phase 2: Documents & Access Control

### Task 10: Document list/create routes
**Description:** `GET /api/documents` (owned vs. shared, separated in the response shape), `POST /api/documents` (create with default empty ProseMirror JSON).
**Acceptance criteria:**
- [ ] `GET` response distinguishes owned from shared documents
- [ ] `POST` creates with the schema's default content
**Verification:** Manual authenticated request.
**Dependencies:** Task 4 (needs `getCurrentUser` — not Task 7, no UI required)
**Files:** `src/app/api/documents/route.ts`, `src/lib/validation/documents.ts`
**Est. time:** 12m

### Task 11: `canView` / `canEdit` helpers
**Description:** `canView(userId, docId)` — true if owner or has a `Share` row. `canEdit` — same (single permission level, no separate view-only tier).
**Acceptance criteria:**
- [ ] Both return `false` uniformly whether the document doesn't exist or simply isn't shared with the user — no distinguishable behavior between the two cases
**Verification:** Exercised by Task 13's integration test.
**Dependencies:** Task 3
**Files:** `src/lib/access-control.ts`
**Est. time:** 8m

### Task 12: Document GET/PATCH route
**Description:** `GET`/`PATCH /api/documents/:id`. Both call `canView`/`canEdit` before touching Prisma. Unauthorized → `403` uniformly, never `404`. No `DELETE` (cut).
**Acceptance criteria:**
- [ ] `GET` requires `canView`; `PATCH` requires `canEdit`; failure → `403` with no detail about document existence
- [ ] `PATCH` accepts `{ title?, content? }` — single endpoint for both
**Verification:** Exercised by Task 13 plus manual checks.
**Dependencies:** Task 11
**Files:** `src/app/api/documents/[id]/route.ts`
**Est. time:** 10m

### Task 13: Integration test — access control
**Description:** The required proof test. User A and user B created directly via Prisma against `TEST_DATABASE_URL`. A `beforeEach` truncates `Share`, then `Document`, then `User` (FK order) so reruns don't collide on `@unique` constraints. User A creates a document. Mint a real JWT for user B via `signSession()`, attach it as a `Cookie` header on a constructed `Request`, import the `GET` handler from Task 12 directly and invoke it — assert `403`. Create a `Share` row for user B. Invoke again — assert `200`.
**Acceptance criteria:**
- [ ] Runs against `TEST_DATABASE_URL`, a real Postgres branch — no mocked Prisma client
- [ ] `beforeEach` cleanup makes the test rerunnable without manual DB resets
- [ ] Session is a genuine signed JWT, not a stubbed user object
- [ ] No dev server started; route handler imported and called directly
**Verification:** `npm test` passes twice in a row without manual cleanup between runs. Manually comment out the `canView` check once, confirm the test fails, then restore it.
**Dependencies:** Task 12
**Files:** `tests/integration/access-control.test.ts`
**Est. time:** 25m

### Task 14: Dashboard document list
**Description:** "My documents" and "Shared with me" sections, create/open actions. No delete button (cut).
**Acceptance criteria:**
- [ ] The two sections are visibly separate
- [ ] Create navigates to the new document's editor page
**Verification:** Manual click-through.
**Dependencies:** Task 10, Task 12
**Files:** `src/app/(app)/dashboard/page.tsx`
**Est. time:** 12m

### CHECKPOINT: Phase 2
- [ ] `npm test` passes, twice in a row
- [ ] Document create/open works end-to-end locally
- [ ] Neither route handler skips `canView`/`canEdit`

---

## Phase 3: Editor

### Task 15: TipTap editor + plain-text toolbar
**Description:** `StarterKit` + `@tiptap/extension-underline`. Plain-text toolbar buttons (no icons — minimal styling): Bold, Italic, Underline, H1, H2, Bullet List, Numbered List.
**Acceptance criteria:**
- [ ] All controls work and reflect active state
- [ ] Editor operates on ProseMirror JSON directly, no HTML intermediate in the running app
**Verification:** Manual — apply each control, confirm visually.
**Dependencies:** Task 14
**Files:** `src/app/(app)/documents/[id]/page.tsx`, editor component
**Est. time:** 15m

### Task 16: Debounced autosave + status indicator
**Description:** ~800ms debounce on content/title changes, single `PATCH /api/documents/:id`, "Saving…" → "Saved" indicator reflecting actual request state.
**Acceptance criteria:**
- [ ] Rapid typing produces one save call after the pause, not one per keystroke
- [ ] Title rename uses the same debounce/endpoint
**Verification:** Manual — type continuously, confirm debounce; reload, confirm persistence.
**Dependencies:** Task 15
**Files:** editor component, save-status hook
**Est. time:** 12m

### CHECKPOINT: Phase 3
- [ ] Formatted content survives reload as JSON, not HTML

---

## Phase 4: Sharing

### Task 17: Share/revoke routes + edge cases
**Description:** `POST /api/documents/:id/shares` (by username), `GET` (list), `DELETE /api/documents/:id/shares/:shareId` (revoke, owner-only). Three edge cases, each a specific error, none a silent no-op or 500:
- Username doesn't exist → literal `404`, "no such user"
- Sharing with yourself → rejected before hitting the database, specific message
- Re-sharing an already-shared user → catch Prisma `P2002` → "already shared with this user"
**Acceptance criteria:**
- [ ] All three edge cases produce the exact behavior above, tested manually
- [ ] Only the owner can share or revoke
**Verification:** Manual — trigger each edge case, confirm response.
**Dependencies:** Task 12
**Files:** `src/app/api/documents/[id]/shares/route.ts`, `.../shares/[shareId]/route.ts`
**Est. time:** 18m

### Task 18: Sharing UI
**Description:** In-editor panel: username input to share, list of current shares with revoke buttons. Unstyled — functional only. Dashboard's "Shared with me" (Task 14) already covers incoming shares.
**Acceptance criteria:**
- [ ] Share and revoke reflected without a full page reload
- [ ] Errors from Task 17's edge cases surface in the UI
**Verification:** Manual, two seeded users, two sessions.
**Dependencies:** Task 17
**Files:** editor page, sharing component
**Est. time:** 10m

### CHECKPOINT: Phase 4
- [ ] Share → immediate edit access. Revoke → next request `403`.

---

## Phase 5: Markdown Import (client-side only — server-side path skipped, not attempted)

### Task 19: Client-side markdown conversion
**Description:** Upload UI reads the file in the browser, runs `marked` → `generateJSON` client-side (real browser DOM, no shim needed), POSTs the resulting ProseMirror JSON to the existing `POST /api/documents` endpoint. Server validates the JSON shape with Zod before persisting. **No server-side `zeed-dom`/`jsdom` attempt — this path was not tried, by deliberate decision, not by failure.**
**Acceptance criteria:**
- [ ] A valid `.md` upload creates a new document with structurally correct headings/lists/bold/italic
- [ ] Underline is absent from imported content (documented limitation)
**Verification:** Manual — upload a `.md` file exercising every supported formatting type.
**Dependencies:** Task 10
**Files:** upload component (client-side conversion logic), reuses `documents/route.ts`'s `POST` with Zod validation on the JSON shape
**Est. time:** 15m

### Task 20: Upload validation
**Description:** `.md` extension check, UTF-8 content-decode check (reject binary renamed to `.md`), 1MB size cap. Each failure mode gets its own specific error.
**Acceptance criteria:**
- [ ] Non-`.md` extension → specific error
- [ ] Binary content with `.md` extension → specific error, not a parse crash
- [ ] File over 1MB → specific error, rejected before parsing
**Verification:** Manual — one test file per failure mode plus one valid file.
**Dependencies:** Task 19
**Files:** upload component
**Est. time:** 10m

### CHECKPOINT: Phase 5
- [ ] All four upload cases (valid, wrong extension, binary-as-md, oversized) behave as specified

---

## Phase 6: Redeploy & Regression

### Task 21: Redeploy and live regression walk
**Description:** Push latest, redeploy. Walk the full flow on the live URL: login → edit/format → autosave → share → revoke (403 confirmed) → upload `.md`.
**Acceptance criteria:**
- [ ] Every step works on the live URL, not just locally
**Verification:** Manual, live URL, incognito.
**Dependencies:** All of Phases 1–5
**Files:** None (deploy only)
**Est. time:** 10m

---

## Phase 7: Non-Code Deliverables

### Task 22: README
**Description:** Setup/run instructions, seeded credentials, scope cuts and why (signup, delete, server-side markdown path — each with reasoning), known limitations (no rate limiting, last-write-wins, underline non-round-trip).
**Acceptance criteria:**
- [ ] A reviewer with zero context can run it locally from the README alone
- [ ] Seeded credentials match the actual seed script
**Verification:** Re-read against what actually shipped.
**Dependencies:** Task 21
**Files:** `README.md`
**Est. time:** 12m

### Task 23: Architecture note
**Description:** Bullet points (not prose, given the budget): data model rationale (`Share` as a join table), access-control design (`canView`/`canEdit` as the sole authorization surface, edge/Node auth split), stack tradeoffs.
**Acceptance criteria:**
- [ ] Covers the "why," not a restatement of the schema
**Verification:** N/A — written deliverable.
**Dependencies:** None beyond the build being done
**Files:** `docs/ARCHITECTURE.md` or a README section
**Est. time:** 8m

### Task 24: AI-workflow note
**Description:** How AI assistance was used through the build; explicitly names the client-side-markdown decision as a deliberate schedule-risk-elimination choice made before implementation, not a fallback discovered by failure.
**Acceptance criteria:**
- [ ] States the markdown-path decision and its reasoning explicitly
**Verification:** N/A — written deliverable.
**Dependencies:** None
**Files:** `docs/AI_WORKFLOW.md` or a README section
**Est. time:** 8m

### Task 25: SUBMISSION.md
**Description:** Live URL, seeded credentials, reviewer quick-start.
**Acceptance criteria:**
- [ ] Everything a reviewer needs is in this one file
**Verification:** N/A — written deliverable.
**Dependencies:** Task 21
**Files:** `SUBMISSION.md`
**Est. time:** 5m

### Task 26: Walkthrough video (3–5 min)
**Description:** Screen recording: login, create + format a document, autosave indicator, share with a second user, confirm access, revoke, upload a `.md` file.
**Acceptance criteria:**
- [ ] Every item above is visibly demonstrated
- [ ] Runs 3–5 minutes
**Verification:** Watch it back once before submitting.
**Dependencies:** Task 21
**Files:** video file / hosted link, referenced from SUBMISSION.md
**Est. time:** 12m

### CHECKPOINT: Submission-ready
- [ ] Live URL works in incognito
- [ ] README, architecture note, AI-workflow note, SUBMISSION.md, video all exist and are accurate to what shipped
- [ ] `npm test` and `npm run typecheck` both pass on the final commit

---

## Stretch (only after Phase 7 is fully done)

### Task 27: Markdown-conversion unit test
**Description:** Unit test for the client-side markdown→TipTap-JSON conversion (Task 19): headings preserved, lists preserved, bold/italic preserved, underline absent.
**Acceptance criteria:**
- [ ] Covers at least one case per formatting type listed above
**Verification:** `npm test`
**Dependencies:** Task 19, and Phase 7 fully complete
**Files:** `tests/unit/markdown.test.ts`
**Est. time:** 15m — lowest priority in the plan; do not start before Phase 7 is done

## Not in this plan

Signup, document delete, and the server-side markdown/DOM-shim path are
**removed**, not deferred — see plan.md's Scope Cuts Applied. These are
permanent scope decisions, not casualties of the budget extension.
