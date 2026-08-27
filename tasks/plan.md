# Implementation Plan: Collaborative Document Editor (~4h55m, all-in budget)

## Overview

**Approved and current.** The budget was originally cut to 2 hours all-in;
that was shown not to fit the protected feature set even at the floor (kept
below as "Budget Reconciliation," for the record), and the decision was made
to extend the budget to match the honest cost of that scope — **~4h55m
total, all-in** — rather than cut further into access control, the
integration test, sharing edge cases, upload validation, or Phase 7. No task
below is compressed to hit a number; every estimate is the same honest one
produced during the 2-hour exercise.

Every pre-approved cut from that round still stands: signup cut, document
delete cut, server-side markdown path skipped entirely (client-side only),
minimal styling throughout. These were scope decisions, not time-pressure
casualties, and remain correct regardless of the budget extension.

## Corrections Folded In

1. **Deploy split.** Task 2 now deploys the bare scaffold immediately (empty
   page, ~10 min, inside the first 20 minutes of work) to catch Vercel
   build / Neon env var / `prisma generate` failures early. The old
   single "Task 8" is now just Task 9: migrate + seed the **production**
   branch and verify login live, after the real app exists.
2. **Neon dual connection strings.** `datasource db` now declares both
   `url = env("DATABASE_URL")` (pooled, app runtime) and
   `directUrl = env("DIRECT_URL")` (unpooled, migrations). `DIRECT_URL` is in
   `.env.example` (Task 1) and in Vercel's env vars (Task 9).
3. **Auth split for edge safety.** `verifySession(token)` (edge-safe,
   `jose`-only, no DB) is what `middleware.ts` calls. `getCurrentUser(req)`
   (Node runtime, DB-backed) is what route handlers call. Middleware never
   touches Prisma.
4. **Integration test hardened.** Task 13 now explicitly mints a real JWT via
   `signSession()` and attaches it as a cookie header on the constructed
   `Request`, and adds a `beforeEach` that truncates `Share`, `Document`,
   then `User` (FK order) on `TEST_DATABASE_URL` so reruns don't collide on
   `@unique` constraints.
5. **Task 10 dependency fixed.** Depends on Task 4 (`getCurrentUser` exists),
   not Task 7 (login pages) — no UI is needed for the documents API to work.
6. **Delete reclassified.** Was miscategorized as a protected addition; it is
   an addition we chose to make, not something the brief requires. It is now
   simply **cut** (see Scope Cuts Applied), not merely deprioritized.

## Scope Cuts Applied (pre-approved, not re-litigated)

- **Signup removed entirely** (route + page). Login + logout only, against
  seeded accounts. The integration test creates its users directly via
  Prisma, so nothing depended on signup existing.
- **Document delete removed entirely** (route + UI). Not in the brief's CRUD
  verbs (create, rename, edit, list, open).
- **Server-side markdown path skipped outright** — no `zeed-dom` attempt, no
  20-minute timebox. Straight to client-side: `marked` + `generateJSON` in
  the browser (real DOM, no shim), POST the resulting ProseMirror JSON to the
  existing create endpoint, server validates the shape with Zod. This is the
  single biggest time saving available and removes the one hard technical
  unknown in the whole build.
- **Minimal styling throughout.** Plain-text toolbar buttons, unstyled lists,
  no visual polish pass anywhere.

**Nothing beyond this pre-approved list was cut.** In particular, I did not
unilaterally trim the protected set (deployment, `canView`/`canEdit`
enforcement, the integration test, all three sharing edge cases, upload
validation, Phase 7) to force a 2-hour number — see Budget Reconciliation for
why, and for the decision this plan needs from you.

## Task List

Full per-task detail lives in [`todo.md`](todo.md).

### Phase 1 — Foundation & Deployment (92 min)

| # | Task | Est. |
|---|------|------|
| 1 | Scaffold Next.js + TS + Tailwind + `.env.example` (`DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL`) | 10m |
| 2 | **Deploy bare scaffold to Vercel** — empty page, verify build/env/`prisma generate` work | 10m |
| 3 | Prisma schema (`url` + `directUrl`), migrate prod branch + test branch | 12m |
| 4 | Auth lib: `verifySession` (edge) + `getCurrentUser` (Node+DB) + password hash/compare | 15m |
| 5 | Login + logout routes (no signup) | 10m |
| 6 | Middleware — calls `verifySession` only | 5m |
| 7 | Minimal login page + dashboard shell | 10m |
| 8 | Seed script (2–3 users, 1 sample doc, 1 existing share, idempotent) | 10m |
| 9 | Migrate + seed **production** branch, redeploy real app, verify login live in incognito | 10m |

**Checkpoint 1:** live URL, seeded login works. Do not proceed to Phase 2
until this passes.

### Phase 2 — Documents & Access Control (67 min)

| # | Task | Est. |
|---|------|------|
| 10 | Document list/create routes (dep: Task 4) | 12m |
| 11 | `canView`/`canEdit` helpers | 8m |
| 12 | Document `GET`/`PATCH` route (no `DELETE`) | 10m |
| 13 | Integration test — real JWT via `signSession`, cookie header on constructed `Request`, `beforeEach` truncate (Share→Document→User) | 25m |
| 14 | Dashboard: "My documents" / "Shared with me" (no delete button) | 12m |

**Checkpoint 2:** `npm test` passes against `TEST_DATABASE_URL`; create/open
works locally.

### Phase 3 — Editor (27 min)

| # | Task | Est. |
|---|------|------|
| 15 | TipTap `StarterKit` + `Underline`, plain-text toolbar | 15m |
| 16 | Debounced (~800ms) autosave via single `PATCH`, Saving/Saved indicator | 12m |

**Checkpoint 3:** formatted content round-trips as JSON, not HTML.

### Phase 4 — Sharing (28 min)

| # | Task | Est. |
|---|------|------|
| 17 | Share/revoke routes + all 3 edge cases (404 no-such-user, self-share rejected, `P2002`→already-shared) | 18m |
| 18 | Unstyled sharing UI (share input, share list, revoke button) | 10m |

**Checkpoint 4:** share → immediate edit access; revoke → next request `403`.

### Phase 5 — Markdown Import, client-side only (25 min)

| # | Task | Est. |
|---|------|------|
| 19 | Client-side `marked` + `generateJSON` in browser, POST JSON to create endpoint | 15m |
| 20 | Upload validation: extension check, UTF-8 decode check, 1MB cap | 10m |

**Checkpoint 5:** valid `.md`, wrong extension, binary-as-`.md`, oversized
file each behave as specified.

### Phase 6 — Redeploy & Regression (10 min)

| # | Task | Est. |
|---|------|------|
| 21 | Redeploy; walk full live flow: login → edit/format → autosave → share → revoke (403) → upload `.md` | 10m |

### Phase 7 — Non-Code Deliverables (45 min) — protected, competes for the same 2 hours under the all-in framing

| # | Task | Est. |
|---|------|------|
| 22 | README: setup, seeded creds, scope cuts (signup, delete, server-markdown path — all with why), known limitations | 12m |
| 23 | Architecture note (bullets, not prose) | 8m |
| 24 | AI-workflow note — names the deliberate client-side-markdown decision as schedule-risk elimination, not failure fallback | 8m |
| 25 | SUBMISSION.md | 5m |
| 26 | Walkthrough video, 3–5 min, single take | 12m |

## Budget Reconciliation (historical record — the 2-hour exercise that led here)

| | Minutes |
|---|---|
| Phases 1–6 (coding) | 249 |
| Phase 7 (docs + video) | 45 |
| **Honest total** | **294 (4h54m)** |
| Originally stated budget | 120 (2h) |
| **Shortfall at the time** | **174 (2h54m)** |

The protected-only floor (deployment, `canView`/`canEdit` enforcement, the
integration test, all 3 sharing edge cases, upload validation, Phase 7,
plus the editor since there's no submission without one) came to **262 min
(4h22m)** — still roughly double the original 2-hour ask even with every
non-protected item (sharing UI, live regression walk) stripped out.

**Resolution:** budget extended to **~4h55m**, matching the honest total
above. Nothing in the protected set was weakened to make a smaller number
work. The task list below is unchanged from that honest estimate.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 2-hour budget doesn't fit protected scope | High | Surfaced explicitly above; needs your call before implementation starts |
| Neon `directUrl` misconfigured, migrations fail | Medium | Task 3 verifies migration against both branches before building on top |
| Middleware accidentally imports something that pulls in Prisma | Medium | `verifySession` lives in a module with zero Prisma imports; `getCurrentUser` is a separate export |
| Integration test collides with itself on rerun | Medium (would have bitten silently) | `beforeEach` truncate now explicit in Task 13 |
| `P2002` on duplicate share surfaces as 500 | Low | Explicit catch in Task 17 |

## Open Questions

None. Budget vs. protected-scope conflict is resolved (extend to ~4h55m,
per above). `todo.md` reflects the full protected scope as specced and is
ready for implementation pending your go-ahead.
