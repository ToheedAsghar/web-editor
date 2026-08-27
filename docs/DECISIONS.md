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
