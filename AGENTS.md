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

- **`components/` is grouped by domain**: `ui/` (the Phase 3.5 primitives and
  anything with no domain), `shell/`, `draft/`, `leagues/`, `awards/`,
  `films/`, `admin/`, `profile/`. A component's test and story sit beside it.
  Import through the alias — `@/components/ui/Button` — and the folder is part
  of the path, so a move is a rename everything else has to follow. 🔴 Three
  guards in `scripts/layering.sh` name specific files as exemptions (`ui/
  RemoteImage`, `ui/Eyebrow`, `ui/SectionHead`, `ui/Wordmark`, `ui/EmptyState`,
  `shell/TabBar`, `shell/SearchOverlay`); moving one of those between folders
  silently disarms its guard unless the script and `.github/workflows/ci.yml`
  are updated together.

- **Biome**, not ESLint or Prettier. `npm run lint` covers linting, formatting, and import order. Biome does not typecheck — `npm run typecheck` is separate.
- **MUI for components, Tailwind for custom styling.** They coexist through CSS cascade layers ordered `theme, base, mui, components, utilities`. Never reach for `!important` to make a Tailwind class beat MUI; if that seems necessary the layer order is wrong. Three Playwright tests in `e2e/smoke.spec.ts` pin this — do not relax them.
- **All local databases run in Docker** (`npm run db:up`). There is no native Postgres server on the dev machine, and the local Postgres binaries are clients only.

  🔴 **Three databases as of 2026-09-13, and the split is the point.**

  | Port | Container | Whose |
  |---|---|---|
  | **5432** | `cinemadraft-postgres` | **The owner's.** `next dev` reads it through `.env.local`. Never run tests against it. |
  | **5433** | `cinemadraft-postgres-executor-1` | Agents and tests. Restored copy. |
  | **5434** | `cinemadraft-postgres-executor-2` | A second agent, in a second worktree. Restored copy. |

  🔴 **Export `DATABASE_URL` for every test run.** `.env.local` points at
  **5432**, the owner's, so a run that inherits it is pointed at the wrong
  database:

  ```bash
  export DATABASE_URL=postgresql://cinemadraft:local@localhost:5433/cinemadraft
  ```

  Two guards catch a mistake, at different moments. `playwright.config.mts`
  **throws at config load** if `DATABASE_URL` names 5432 — it has to be before a
  single row is written, because the browser specs create real leagues, seats
  and accounts. `lib/db.test.ts` refuses any port but 5433/5434, which catches a
  unit run but only after it has finished.

  🔴 **A migration has to be applied to all three, by hand.** There is no
  hook that fans one out. An agent runs `prisma migrate deploy` against its own
  executor, the other two stay behind, and the first symptom is the owner's dev
  server throwing `The column ... does not exist in the current database` on a
  page that has nothing to do with the change — which is exactly what happened
  within an hour of the split, on 2026-09-13. After adding a migration:

  ```bash
  for P in 5432 5433 5434; do
    DATABASE_URL=postgresql://cinemadraft:local@localhost:$P/cinemadraft \
      npx prisma migrate deploy
  done
  ```

  Safe to re-run: `migrate deploy` applies only what is pending and touches no
  rows. Verify with `\d events` or an `information_schema.columns` count on each
  port rather than trusting the command's own output.

  🔴 **`npx prisma generate` belongs in the main checkout only.** A worktree
  hardlinks `generated/`, so running it there writes the main checkout's files
  underneath whoever is working in it.

  **Why three.** They used to be two, and 5433 was both the test baseline and
  what `next dev` read. On 2026-09-13 the owner signed in to verify the Clerk
  flow and made a league while clicking around — ordinary use — and nine tests
  went red asserting the restored copy was pristine. Worse, it could not be
  cleaned up: blanking `clerk_id` is exactly what makes a row claimable again,
  so the next page load re-claimed it. Separating the owner's database from the
  executors is what fixed it, and it is why the row counts below can still be
  exact.

  - **The executors are restored copies of production.** League 1 is sixty real people's history, and `lib/db.test.ts` asserts exact row counts against them (60 users / 13 leagues / 1,355 movies / 156 drafts).
  - **5434 is the second worktree's database**, an identical clone of 5433. It exists so two agents can run tests and browsers at once: the suite's DB-backed project is serial by design, because `available_years_one_active` is a global partial unique index with no per-worker copy, so two runs against *one* database race it. Point a run at it by exporting `DATABASE_URL=postgresql://cinemadraft:local@localhost:5434/cinemadraft` — process env beats `.env.local` in Vitest, Playwright and Next alike.
  - 🔴 `lib/db.test.ts` asserts the port too, not only the counts — it accepts **either** 5433 or 5434, and rejects both Neon and the owner's 5432. An earlier version of this note claimed only the counts mattered; that was wrong, and the second database failed that one test and nothing else until it was fixed.
  - Re-clone it whenever it drifts: `pg_dump -h localhost -p 5433 … -Fc` piped into `pg_restore -h localhost -p 5434 … --clean --if-exists`. Both must sit at the baseline counts above, or `lib/db.test.ts` fails on whichever one a run happens to use.
- **Two agents at once means two worktrees and two databases.** One checkout cannot hold two builds: `npm run build` writes a shared `.next/`, so two production builds race each other silently and each measures a directory the other is overwriting. The git index is shared too — staging a file someone else is mid-edit sweeps their work into your commit, which has happened here.

  🔴 **Use `npm run agent:up <name>` rather than the recipe below.** It creates
  the worktree, hardlinks `node_modules` and `generated`, starts a Postgres of
  its own on the first free port from 5440, restores `.local/baseline.dump`,
  brings the schema current with `prisma migrate deploy`, and prints the
  `export` lines to `eval`. `npm run agent:down <name> --env-only` is what the
  AGENT runs when it finishes — it removes that database and frees the ports but
  keeps the worktree and branch, which still hold the work; the plain form is
  what the orchestrator runs after merging, and it refuses while the branch has
  commits `dev` does not.

  That removes the ceiling of two. `lib/db.test.ts` used to pin ports 5433/5434,
  so a third database failed its assertion and the failure read as "the new
  database is broken"; it now accepts any local port from 5433 up and refuses
  5432 and Neon. 🔴 The baseline is a **data** fixture only — `agent:up` runs
  migrations after restoring, so a schema change does NOT require recapturing
  it. Refresh it with `npm run agent:baseline <port>` only when the rows should
  change; it refuses a source that has drifted from 60/13/1355/156 or that is
  the owner's 5432.

  The manual recipe, for reference, with the two traps that cost time:

  ```bash
  git worktree add -b <task-branch> /Users/jonbernard/Development/.cd-wt-<name> main
  cp -al node_modules generated /Users/jonbernard/Development/.cd-wt-<name>/   # hardlinks, instant
  cp .env .env.local /Users/jonbernard/Development/.cd-wt-<name>/
  ```

  🔴 **Hardlink `node_modules`; never symlink it.** Turbopack rejects a symlink outright — `Symlink [project]/node_modules is invalid, it points out of the filesystem root` — and the build fails with no useful hint. 🔴 **`generated/` must be copied too**: Prisma's client is gitignored, so a fresh worktree has none, typecheck silently collapses Prisma types to `any`, and the DB-backed tests fail to import.

  Each worktree exports its own `DATABASE_URL` (5433 or 5434) and starts its own server on its own port. Commit on the task branch and merge; two worktrees cannot both check out `main`.

  🔴 **Never `git reset --hard` (or `checkout --`, `restore`, `clean`) in a
  checkout another agent is working in.** Run `git status --porcelain` first and
  read it; if anything modified is not yours, do not run the command. Unstaged
  changes never enter git's object store, so there is nothing to recover them
  from afterwards — this destroyed a subagent's in-progress edits to five files
  on 2026-09-13, and the agent had to re-apply them from its own context.

  To undo a commit, `git revert`. To back out a merge with a dirty tree,
  `git reset --merge` or `git reset --keep`, both of which **refuse** rather
  than discard. `--hard` is never the way to tidy up.

  This is a worse hazard than the stash below, not a milder one: the stash needs
  two agents to both reach for it, while `reset --hard` needs only one agent and
  takes everyone's work in that checkout.

  🔴 **Never `git stash` while two worktrees are live.** The stash stack is a
  property of the **repository**, not of the worktree — `git stash` in one and
  `git stash pop` in another crosses the streams. This happened on 2026-09-13:
  two agents each stashed to check a clean baseline, and one popped the other's
  uncommitted work into its own tree, sending three new spec files into the
  wrong worktree and stripping a page and two services out of the other. Both
  were recovered, by hand, from a patch — the next pair might not be.

  The stash is the *second* shared thing agents assume is private. The index is
  the first, and it is documented above. If you need a clean tree to measure
  something, commit to your branch, copy the files aside, or add a third
  worktree. Never the stash.

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
