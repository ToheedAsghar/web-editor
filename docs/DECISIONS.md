# Decision Log

Live log of anything tried that didn't work, corrections to a first approach,
suggestions the user rejected, and library/tooling quirks that cost real
time. Feeds the AI-workflow note (Task 24). Written at the moment each thing
happens, not reconstructed afterward.

## Task 1: Scaffold

- The sandbox's global npm config (`/app/etc/npmrc`) points `prefix`/`cache`/
  `tmp` at a VSCode Flatpak path (`/home/toheed/.var/app/com.visualstudio.code/...`)
  that doesn't exist in this environment. `npx create-next-app` failed with
  `ENOENT` until these were overridden per-command via
  `NPM_CONFIG_PREFIX`/`npm_config_cache`/`npm_config_tmp` pointed at a real
  directory. Did not touch the global npmrc — not this project's file to
  change, and per-command env override is enough.
- First override attempt pointed those paths at `/tmp`, which turned out to
  be a small tmpfs (783M total) already over half full — `npm install` died
  with `ENOSPC` partway through. Moved the override to a directory under
  `/home` (`~/.npm-fix/`), which has 33G free, and it installed cleanly.
- `create-next-app@latest` (Next 16.x) requires Node ≥20.9; this environment
  has Node 18.20.8. Pinned to `create-next-app@14` instead, which matches
  SPEC.md's "Next.js 14+" anyway and supports Node 18.
- `create-next-app` refuses to scaffold into a non-empty directory, and this
  directory already had `SPEC.md` and `tasks/` from the planning phase.
  Scaffolded into a throwaway directory instead and moved the generated
  files in afterward, skipping anything that would have collided (nothing
  did).
- The `--no-git` flag was passed but `create-next-app@14` initialized a git
  repo and made an "Initial commit from Create Next App" anyway — the flag
  appears to be ignored on this version. Kept that commit as the base rather
  than fighting it; it's an accurate, harmless first commit.
- Found a stray `.claude/scheduled_tasks.lock` file in the project root — an
  artifact of the harness (from an earlier misuse of a scheduling tool that
  didn't belong in this workflow), not project code. Added `.claude/` to
  `.gitignore` rather than committing it.

## Task 2: Push to GitHub

- `git push` over HTTPS failed: `git config`'s configured credential helper
  (`git-credential-libsecret`) points at a binary that doesn't exist on this
  sandbox (`No such file or directory`), so there was no way to supply HTTPS
  credentials. Switched the remote to SSH (`git@github.com:...`) instead —
  an SSH key was already present and pre-authenticated to the account, so
  this worked with no further setup.

## Task 3: Neon setup

- The Neon CLI requires Node ≥20.19.0; this sandbox's default is 18.20.8.
  A second Node install (v25.2.1) was already present via nvm — used that
  for every Neon CLI invocation instead of asking to change the project's
  Node version.
- `neon projects list` failed with a misleading `Could not reach the Neon
  API` error. The real cause: this API key is org-scoped and the command
  needs `--org-id` explicitly. Confirmed by calling the same endpoint with
  `curl` directly, which returned a clear `org_id is required` 400 instead
  of the CLI's generic network-error message. Added `--org-id
  org-twilight-boat-82497716` to every subsequent command.
- **Real bug, not a misconfiguration:** `neon connection-string --branch-id
  <test-branch>` returned the *production* branch's connection string, not
  the test branch's. It silently ignored the explicit `--branch-id` flag and
  used the branch pinned in the local `.neon` link file (`"branch":
  "production"`) instead. Verified this was the CLI's behavior, not a wrong
  branch ID on my part, by cross-checking the production branch's direct URL
  from the CLI against the same call made via `curl` against the REST API
  directly — REST returned the correct, distinct URL for each branch when
  given each `branch_id`. Used direct `curl` calls to
  `console.neon.tech/api/v2/.../connection_uri` for both branches instead of
  trusting the CLI's per-branch connection-string command.
- `TEST_DATABASE_URL` uses the test branch's **direct** (unpooled) URL, not
  pooled — same simplification as `DATABASE_URL`/`DIRECT_URL` on production:
  avoids a fourth env var, and the integration test's connection volume is
  low enough that pooling doesn't matter there.

## Task 4: Auth library

- `next build` warns that `jose` (imported only in `auth-edge.ts`, for
  `SignJWT`/`jwtVerify`) pulls in `CompressionStream`/`DecompressionStream`
  via its JWE (encryption) code path, flagged as unsupported in the Edge
  Runtime. This is a known, widely-reported `jose`+Next.js false positive:
  those code paths belong to JWE's `zip` option, which this code never
  invokes (only JWS signing/verification is used), and `CompressionStream`
  is a standard Web Streams API available in the Edge Runtime regardless —
  Next's static analyzer flags the import conservatively, not actual
  unsupported usage. Not fixed, since there's nothing to fix — flagging it
  here so it isn't mistaken for a real problem, and it gets a real-world
  check at Task 9 when the middleware runs live on Vercel's edge network.
  **Confirmed benign at Task 9**: middleware correctly redirected an
  unauthenticated `/dashboard` request (307 → `/login`) and passed through
  an authenticated one, live on Vercel — the warning never manifested as a
  runtime failure.

## Task 13: Integration test

- First run of the access-control test timed out at Vitest's default 5000ms
  — the test branch's compute had scaled to zero (idle since Task 3's
  migration) and needed a cold start. Bumped `testTimeout` to 20000ms in
  `vitest.config.ts` rather than trying to keep the branch warm; a cold
  Neon branch is the normal case for CI, not a one-off fluke.
- Wired `vitest.setup.ts` (via `dotenv` + a `testTimeout`/`setupFiles`
  entry in `vitest.config.ts`) to override `process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL` before any module loads — this makes the
  app's own `src/lib/db.ts` Prisma singleton point at the test branch for
  the whole test run, so the test and the route handler under test share
  one client/connection instead of needing a second one.
- Verified per instruction: temporarily commented out the `canView` check
  in `documents/[id]/route.ts`, reran the test, watched it fail
  (`expected 200 to be 403`), then restored the check and confirmed it
  passes again. The test is a real assertion, not a tautology.

## Tasks 15-16: Editor + autosave

- `npm install` resolved TipTap to **v3.30.5**, not v2 — the spec's stack
  decision ("StarterKit + `@tiptap/extension-underline`") was written
  against v2's behavior. Checked the installed package's own type
  definitions rather than assume: TipTap v3's `StarterKit` now bundles an
  `underline` mark by default, which would collide with the separately
  added `Underline` extension (duplicate-extension conflict). Fixed with
  `StarterKit.configure({ underline: false })`, keeping both packages as
  the spec named them.
- Also confirmed via `@tiptap/react`'s type definitions (not memory) that
  `useEditor` needs `immediatelyRender: false` for SSR frameworks — without
  it, TipTap renders immediately during Next's server render and produces
  a client hydration mismatch. Set it explicitly.
- **Real bug caught by actually running the app, not just typecheck/build**:
  with `immediatelyRender: false`, `useEditor` returns `null` until the
  client mounts. My first version had `if (!editor) return null` gating the
  *entire* component return, meaning the whole page — including the title
  input, completely unrelated to the editor being ready — rendered blank
  during SSR and the first client paint. Confirmed via `curl` against a
  running dev server (typecheck/build both stayed green through this the
  whole time, since it's a runtime/UX issue, not a type error). Fixed by
  only gating the toolbar/`EditorContent` on `editor` being non-null, with
  a "Loading editor…" placeholder — the title bar now renders immediately.
- No headless browser tool is available in this sandbox (checked; only a
  static-content `WebFetch` exists, no MCP browser/devtools tool). Verified
  what curl can prove — SSR HTML, no server exceptions, correct
  access-control behavior (200 with a generic message for `carol`, who has
  no access, never a distinguishable 404) — but did not click through the
  live toolbar/typing interactions in a real browser. Flagged to the user
  rather than claimed full UI verification.
- Observed one transient "Can't reach database server" error from Prisma
  immediately after a slow (4.8s) login request — consistent with a Neon
  compute cold-starting and the connection pool not yet being stable a
  moment later. Retried and it worked cleanly. Not a code bug, but worth
  keeping in mind for the walkthrough video: hitting the app after any
  idle period may need a throwaway first request to warm the compute
  before recording.
