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
  - 🔴 `lib/db.test.ts` asserts the port too, not only the counts — it accepts **either** 5433 or 5434 and rejects Neon. An earlier version of this note claimed only the counts mattered; that was wrong, and the second database failed that one test and nothing else until it was fixed.
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

  🔴 **Tear the worktree down when the work is done, and check before you do.** A worktree left lying around is where work goes to be forgotten — and the two ways it disappears are different. Uncommitted changes are safe by accident: `git worktree remove` refuses unless you pass `--force`, so never reach for `--force` to make an error go away. **Committed work on an unmerged branch is the real hazard** — removing the worktree leaves the branch behind, nothing complains, and the commits sit there invisible until somebody runs `git branch`. Check, merge, then remove:

  ```bash
  git -C <worktree> status --porcelain      # must be empty
  git log main..<task-branch> --oneline     # must be empty, or merge it first
  git worktree remove <worktree>            # no --force
  git branch -d <task-branch>               # -d, not -D: it refuses if unmerged
  git worktree list                         # what is actually left
  ```

  `git branch -d` refusing is a feature — it is the last thing standing between "cleaned up" and "deleted a day's work". If it refuses, something is unmerged; go and look.

- 🔴 **A verification step that cannot fail is not verification.** This is the single most recurring defect in this project's plans — seven instances in one day, several written by the people checking for them. Before relying on any check, ask what would make it go red, and if the answer is "nothing", replace it and say so. Real examples: a nameless-link counter that counted `aria-hidden` anchors, so it could never reach zero; a "year top within 2px of title top" bound that baseline alignment makes *unreachable by a correct implementation*; Chrome's `Priority: High`, which it sets on in-viewport images regardless; `animation-name: stamp`, which reads back with the `@keyframes` block deleted; a "two leagues differ" test that called one function twice with one argument; a total-equals-sum check reading both numbers from the same map; a query-count bound set so loose it would not have noticed the query being added.

  The habit that catches these: **mutate the implementation, watch the test go red, restore.** Every task in Phases 15 and 17 does this, and it has caught real holes — including a plan's own test that passed against a deliberately broken build.

- **Measure in a production build, not `next dev`.** A design review run against a dev server produced five findings that were artefacts: a "detached avatar" that was Next's dev-tools indicator, a 1024px table overflow that does not exist in production, a film-page width taken from a different film, award marks described as dark-on-transparent that are opaque JPEGs, and a dead column off by 700px. 🔴 `next dev` also answers **403 for every `_next/static` chunk on `127.0.0.1`** while `localhost` serves fine — so a dev measurement on that host is of an unstyled page. `npm run start` is unaffected by both problems.

- 🔴 **Run the unit suite with `E2E_TEST_AUTH` unset.** Exported, it turns 186 unit tests red on `headers` called outside a request scope — a wall of failures that looks like catastrophic breakage and is only a leaked environment variable from a browser run. The e2e suite sets it for its own server; nothing else should inherit it.

- 🔴 **`npm run test:ci` passing locally does not mean CI passes.** It runs against *your* database, which holds the restored production copy — so a test that reads real rows passes locally and fails on CI, where the database is migrations plus a minimal seed. This has broken `main` twice. To actually reproduce CI, point it at an empty one:

  ```bash
  docker run --rm -d --name ci-verify-pg -e POSTGRES_USER=cinemadraft \
    -e POSTGRES_PASSWORD=local -e POSTGRES_DB=cinemadraft -p 5435:5432 postgres:17
  export DATABASE_URL=postgresql://cinemadraft:local@localhost:5435/cinemadraft
  npx prisma migrate deploy && node scripts/seed-e2e.mjs && npm run test:ci
  docker rm -f ci-verify-pg
  ```

  Note 5434 is **not** this check — it is a clone of the restored copy, so it holds the same data and hides the same failure. A test that needs restored rows belongs in `vitest.ci.config.mts`'s exclusion list, **excluded rather than weakened into something that would pass anywhere**; that file's header explains the rule and every entry says which real rows it reads.

- **The unit suite runs as two Vitest projects** (`vitest.config.mts`). The `parallel` project holds every test the config can *prove* never reaches `lib/db.ts`, by walking the import graph; the `db` project is everything else and keeps `fileParallelism: false`, because `available_years_one_active` is a global partial unique index with no per-worker copy. 🔴 **Serial is the default and parallel is opt-in by proof** — a new DB-backed test falls through to serial with nobody remembering anything. The parallel project runs with `DATABASE_URL` pointed at a dead port on purpose, so a misclassified test fails on connect every run instead of racing the invariant once in three. Do not "fix" that URL.

- **To watch the e2e suite rather than read it**, run it with a temporary config that extends `playwright.config.mts` with `use: { video: 'on' }`, `workers: 1` and an `outputDir` outside the repo, then open the HTML report. One worker matters: parallel workers interleave recordings from different tests. Phase 19 makes this a first-class script with paced, captioned journeys.

- **`fixtures/` is generated** by `scripts/scrub-fixtures.mjs` from the gitignored raw capture in `.local/`. Never hand-edit it, and never let a formatter touch it — the scrubber asserts byte-identical output on re-run.
- **Award nominations and winners are entered by the `award-entry` skill**, not
  by hand through the admin UI. It drives `scripts/award-import.mjs`, which is
  the only thing that writes scoring inputs to production, and always ends with
  `refresh` — the script cannot call `revalidatePath`, so
  `app/api/revalidate/route.ts` does it on the script's behalf. The skill file
  (`.claude/skills/award-entry/SKILL.md`) is the runbook, including the
  one-time `REVALIDATE_SECRET` setup without which `refresh` refuses to run.
