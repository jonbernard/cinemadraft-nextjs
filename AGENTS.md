<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules

## Never regenerate package-lock.json on macOS

Run `npm run lock`, which regenerates it inside the same `node:24` image CI uses. Do **not** run bare `npm install` and commit the resulting lockfile from a Mac.

`lightningcss` (via Tailwind 4 and Vite) declares optional per-platform binaries. A lockfile generated on macOS arm64 is broken for Linux in one of two ways, depending on the local npm version:

- npm 11.13 writes the `lightningcss-darwin-x64` entries with **no `version` field**. npm 11.17 then rejects the whole lockfile with `npm error Invalid Version:` — which names neither the package nor the field.
- npm 11.17 **omits those entries entirely**, and `npm ci` on Linux fails with `Missing: lightningcss-darwin-x64@1.32.0 from lock file`.

Either way it installs fine locally and fails only in CI and on Vercel. The `lockfile` job in `.github/workflows/ci.yml` catches both and tells you to run `npm run lock`.

Adding or upgrading a dependency: run `npm install <pkg>` normally so `package.json` is updated, then run `npm run lock` before committing.

## Other conventions

- **Biome**, not ESLint or Prettier. `npm run lint` covers linting, formatting, and import order. Biome does not typecheck — `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling.** They coexist through CSS cascade layers ordered `theme, base, mui, components, utilities`. Never reach for `!important` to make a Tailwind class beat MUI; if that seems necessary the layer order is wrong. Three Playwright tests in `e2e/smoke.spec.ts` pin this — do not relax them.
- **All local databases run in Docker** (`npm run db:up`, which starts both). There is no native Postgres server on the dev machine, and the local Postgres binaries are clients only.
  - **5433 is the primary** — a restored copy of production. League 1 is sixty real people's history, and `lib/db.test.ts` asserts exact row counts against it (60 users / 13 leagues / 1,355 movies / 156 drafts).
  - **5434 is the second worktree's database**, an identical clone. It exists so two agents can run tests and browsers at once: the suite's DB-backed project is serial by design, because `available_years_one_active` is a global partial unique index with no per-worker copy, so two runs against *one* database race it. Point a run at it by exporting `DATABASE_URL=postgresql://cinemadraft:local@localhost:5434/cinemadraft` — process env beats `.env.local` in Vitest, Playwright and Next alike.
  - Re-clone it whenever it drifts: `pg_dump -h localhost -p 5433 … -Fc` piped into `pg_restore -h localhost -p 5434 … --clean --if-exists`. Both must sit at the baseline counts above, or `lib/db.test.ts` fails on whichever one a run happens to use.
- **Two agents at once means two worktrees and two databases.** One checkout cannot hold two builds: `npm run build` writes a shared `.next/`, so two production builds race each other silently and each measures a directory the other is overwriting. The git index is shared too — staging a file someone else is mid-edit sweeps their work into your commit, which has happened here.

  Recipe, with the two traps that cost time:

  ```bash
  git worktree add -b <task-branch> /Users/jonbernard/Development/.cd-wt-<name> main
  cp -al node_modules generated /Users/jonbernard/Development/.cd-wt-<name>/   # hardlinks, instant
  cp .env .env.local /Users/jonbernard/Development/.cd-wt-<name>/
  ```

  🔴 **Hardlink `node_modules`; never symlink it.** Turbopack rejects a symlink outright — `Symlink [project]/node_modules is invalid, it points out of the filesystem root` — and the build fails with no useful hint. 🔴 **`generated/` must be copied too**: Prisma's client is gitignored, so a fresh worktree has none, typecheck silently collapses Prisma types to `any`, and the DB-backed tests fail to import.

  Each worktree exports its own `DATABASE_URL` (5433 or 5434) and starts its own server on its own port. Commit on the task branch and merge; two worktrees cannot both check out `main`.

- **`fixtures/` is generated** by `scripts/scrub-fixtures.mjs` from the gitignored raw capture in `.local/`. Never hand-edit it, and never let a formatter touch it — the scrubber asserts byte-identical output on re-run.
- **Award nominations and winners are entered by the `award-entry` skill**, not
  by hand through the admin UI. It drives `scripts/award-import.mjs`, which is
  the only thing that writes scoring inputs to production, and always ends with
  `refresh` — the script cannot call `revalidatePath`, so
  `app/api/revalidate/route.ts` does it on the script's behalf. The skill file
  (`.claude/skills/award-entry/SKILL.md`) is the runbook, including the
  one-time `REVALIDATE_SECRET` setup without which `refresh` refuses to run.
