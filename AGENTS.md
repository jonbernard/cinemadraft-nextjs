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
- **All local databases run in Docker** (`npm run db:up`). There is no native Postgres server on the dev machine, and the local Postgres binaries are clients only.
- **`fixtures/` is generated** by `scripts/scrub-fixtures.mjs` from the gitignored raw capture in `.local/`. Never hand-edit it, and never let a formatter touch it — the scrubber asserts byte-identical output on re-run.
