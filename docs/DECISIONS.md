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
