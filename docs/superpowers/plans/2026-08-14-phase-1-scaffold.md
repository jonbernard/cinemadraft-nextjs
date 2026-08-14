# Phase 1 — Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an empty but fully wired Next.js application — TypeScript strict, MUI + Tailwind coexisting through cascade layers, lint, unit tests, E2E tests, CI, a local Docker Postgres, and a green Vercel preview — so every later phase writes feature code rather than plumbing.

**Architecture:** Next 16 App Router at the repository root (no `src/`), matching spec §5. MUI supplies components and Tailwind supplies custom styling; they coexist because `AppRouterCacheProvider` emits emotion output into a `mui` cascade layer that sits above Tailwind's `base` and below its `utilities`. Nothing in this phase touches the database, auth, or design tokens — those are Phases 2, 4 and 3.

**Tech Stack:** Next 16.3.1 · React 19.2.8 · TypeScript strict · MUI 9.3.1 · Tailwind 4.3.3 · Biome 2.5.8 · Vitest · Playwright · GitHub Actions · Docker Postgres 17

## Global Constraints

Every task inherits these, from `docs/PLAN.md` and the spec.

- **Node 24.** Pinned in `.nvmrc` and `package.json` `engines`, matching the Vercel project setting.
- **Latest stable, always** (D28). Check the npm registry before writing a version anywhere. Never infer a version from memory.
- **All local databases run in Docker.** No native Postgres server. Local Postgres binaries are client-only (`libpq`).
- **TypeScript strict.** No `any` in committed code without an inline justification comment.
- **App Router only.** No Pages Router.
- **MUI for components, Tailwind for custom styling** (D3, D29). No shadcn.
- **Cascade layer order is `@layer theme, base, mui, components, utilities`** with `enableCssLayer: true`. Never use `!important` to make Tailwind beat MUI.
- **No secret is ever committed.** `.local/` and `.env*` stay gitignored.
- **Neon is Preview/Production only.** Local development and tests point at the Docker container, never Neon.
- One commit per task, message prefixed with the task ID (`P1.T3: …`). Tick the box in `docs/PROGRESS.md` as the final step of each task.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | Scripts, deps, Node 24 engine pin |
| `.nvmrc` | Node 24 for local shells and CI |
| `tsconfig.json` | Strict TypeScript, `@/*` path alias |
| `next.config.ts` | Next configuration |
| `app/layout.tsx` | Root layout — html/body, cache provider, theme provider |
| `app/globals.css` | Cascade layer declaration + Tailwind import |
| `app/page.tsx` | Placeholder home, replaced in Phase 5 |
| `theme/index.ts` | Minimal MUI theme; real tokens land in Phase 3 |
| `biome.json` | Lint + format + import assist, one config |
| `vitest.config.ts` | Unit test runner |
| `playwright.config.ts` | E2E runner, boots `next dev` |
| `.github/workflows/ci.yml` | lint · typecheck · unit · build · e2e |
| `docker-compose.local.yml` | Local Postgres 17 |

The `lib/`, `actions/`, `components/` trees are created in T7 with `.gitkeep` placeholders so the skeleton is visible from the first commit.

---

## Task 1: Scaffold Next.js at the repository root

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.nvmrc`, `AGENTS.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: an installable, buildable Next 16 app at the repo root with the `@/*` import alias.

`create-next-app` refuses to run in a directory containing files it doesn't recognise, and this repo already holds `docs/`, `scripts/`, `fixtures/`, `.local/`, `.vercel/`. So scaffold into a temporary directory and move the output in.

- [ ] **Step 1: Scaffold into a temp directory**

```bash
cd /tmp && rm -rf cd-scaffold
npx --yes create-next-app@latest cd-scaffold \
  --ts --app --eslint --tailwind --no-src-dir \
  --import-alias "@/*" --use-npm --disable-git --empty --yes
```

`--tailwind` is required by D29. `--no-src-dir` matches spec §5, which puts `app/`, `lib/`, `actions/` at the root. `--disable-git` matters — this repo already has history that must not be reinitialised.

- [ ] **Step 2: Move the scaffold in, without clobbering existing work**

```bash
cd /Users/jonbernard/Development/cinemadraft-nextjs
for f in package.json package-lock.json tsconfig.json next.config.ts \
         eslint.config.mjs postcss.config.mjs next-env.d.ts AGENTS.md app public; do
  [ -e "/tmp/cd-scaffold/$f" ] && cp -R "/tmp/cd-scaffold/$f" .
done
cat /tmp/cd-scaffold/.gitignore >> .gitignore
```

Append to `.gitignore` rather than overwriting — the existing file carries the `.local/` and `.env*` rules that keep the dump and fixtures out of git.

- [ ] **Step 3: Deduplicate .gitignore and confirm the protective rules survived**

```bash
awk '!seen[$0]++ || /^$/' .gitignore > .gitignore.tmp && mv .gitignore.tmp .gitignore
git check-ignore -v .local/prod-dump.dump .env.local
```

Expected: both paths report as ignored. If either does not, stop and fix before continuing — the next commit would publish production data.

- [ ] **Step 4: Pin Node 24**

```bash
echo "24" > .nvmrc
npm pkg set engines.node=">=24 <25"
```

- [ ] **Step 5: Install and verify the scaffold builds**

```bash
npm install
npm run build
```

Expected: build succeeds. Record the resolved versions of `next`, `react`, and `tailwindcss` — later tasks assume them.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "P1.T1: scaffold Next 16 app at the repository root"
```

---

## Task 2: MUI over Tailwind, verified by assertion

**Files:**
- Create: `theme/index.ts`, `app/providers.tsx`
- Modify: `app/layout.tsx`, `app/globals.css`

**Interfaces:**
- Produces: `Providers` (client component wrapping `AppRouterCacheProvider` + `ThemeProvider`), and a `mui` cascade layer ordered between Tailwind's `base` and `utilities`.

This is the task most likely to be got subtly wrong, so it ends with a test that renders a real MUI component and asserts Tailwind wins.

- [ ] **Step 1: Install MUI**

```bash
npm i @mui/material @mui/material-nextjs @emotion/react @emotion/styled @emotion/cache
```

- [ ] **Step 2: Declare the layer order**

`app/globals.css` — the layer statement must come **before** the Tailwind import, because the first `@layer` declaration wins and Tailwind's own statement would otherwise set the order.

```css
/* mui sits above base so Tailwind preflight cannot strip MUI component
   styling, and below utilities so Tailwind classes override MUI without
   !important. Changing this order breaks one of those two properties. */
@layer theme, base, mui, components, utilities;

@import "tailwindcss";
```

- [ ] **Step 3: Minimal theme**

`theme/index.ts` — deliberately bare. The real tokens, palettes and typography arrive in Phase 3; putting them here now would mean writing them twice.

```ts
'use client';

import { createTheme } from '@mui/material/styles';

// Phase 3 replaces this wholesale with the token system from spec §6.
export const theme = createTheme({
  cssVariables: true,
});
```

- [ ] **Step 4: Providers**

`app/providers.tsx`:

```tsx
'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { ReactNode } from 'react';
import { theme } from '@/theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
```

`enableCssLayer: true` is what puts emotion's output into the `mui` layer. Without it the layer statement in `globals.css` has nothing to order and MUI styles land unlayered, which beats every Tailwind utility.

- [ ] **Step 5: Wire the root layout**

`app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cinemadraft',
  description: 'Fantasy movie award leagues',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Prove the layering works**

Replace `app/page.tsx` with a probe that Task 5's E2E test asserts against:

```tsx
import Button from '@mui/material/Button';

export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Cinemadraft</h1>
      <Button variant="contained" data-testid="mui-button">
        MUI button
      </Button>
      <Button
        variant="contained"
        className="bg-black"
        data-testid="tailwind-wins"
      >
        Tailwind overrides MUI
      </Button>
    </main>
  );
}
```

Two assertions come out of this in T5: the plain MUI button has its themed background (proving preflight did not strip it), and the second button is black (proving a Tailwind utility beats MUI's own class).

- [ ] **Step 7: Verify by eye once, then automate**

```bash
npm run build && npm run dev
```

Open the page. The first button must look like a normal contained MUI button; the second must be black. If the first is unstyled, `mui` is ordered below `base`. If the second is not black, `mui` is ordered above `utilities` or `enableCssLayer` is missing.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "P1.T2: MUI and Tailwind coexisting via cascade layers"
```

---

## Task 3: Biome

**Files:**
- Create: `biome.json`
- Delete: `eslint.config.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`, `npm run typecheck`.

Biome replaces ESLint and Prettier with a single tool — one config, one pass, no plugin resolution. Version 2.5.8 ships **rule domains**, which is what makes this a real upgrade rather than a swap: enabling the `next`, `react`, and `tailwind` domains turns on framework-aware rules that would otherwise need three separate ESLint plugins kept in version lockstep.

What Biome does **not** replace: `tsc`. Biome does not typecheck, so `npm run typecheck` remains a separate command and a separate CI step.

- [ ] **Step 1: Remove ESLint**

```bash
npm uninstall eslint eslint-config-next
rm -f eslint.config.mjs
```

- [ ] **Step 2: Install Biome**

```bash
npm i -D --save-exact @biomejs/biome@latest
```

Pinned exactly, not with a caret. Biome's lint rules evolve between minors, and a floating range means CI can start failing on a commit that changed no code.

- [ ] **Step 3: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.8/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": ["**", "!fixtures/**", "!.next/**", "!next-env.d.ts"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 90
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  },
  "linter": {
    "enabled": true,
    "domains": {
      "next": "all",
      "react": "all",
      "tailwind": "recommended",
      "test": "recommended",
      "project": "recommended"
    },
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "error"
      },
      "style": {
        "noNonNullAssertion": "error",
        "useConst": "error",
        "useImportType": "error",
        "noParameterAssign": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noConsole": { "level": "error", "options": { "allow": ["warn", "error"] } }
      }
    }
  },
  "assist": {
    "actions": {
      "source": {
        "organizeImports": "on"
      }
    }
  }
}
```

Three of these choices are deliberate and worth not undoing:

- `fixtures/**` is excluded. It is generated output from `scripts/scrub-fixtures.mjs`, and reformatting it would break that script's byte-identical determinism check.
- `noExplicitAny` and `noNonNullAssertion` are errors, not warnings, matching the global TypeScript-strict constraint. A warning in CI is a warning nobody reads.
- `noConsole` allows `warn` and `error` only. Server Components log to the platform; stray `console.log` in a Server Action leaks into Vercel's function logs.

`vcs.useIgnoreFile` means Biome honours `.gitignore`, so `.local/` and `.env*` are skipped without being restated.

- [ ] **Step 4: Scripts**

```bash
npm pkg set scripts.lint="biome check"
npm pkg set scripts.lint:fix="biome check --write"
npm pkg set scripts.format="biome format --write"
npm pkg set scripts.format:check="biome format"
npm pkg set scripts.typecheck="tsc --noEmit"
```

`biome check` runs the formatter, linter, and import assist together — it is the single command CI needs.

- [ ] **Step 5: Apply it to the existing code**

```bash
npm run lint:fix
```

The scaffold was written with double quotes; this rewrites it. Read the diff rather than accepting it blind — this is the one moment where a formatter touches every file, and it is the cheapest time to notice it doing something unwanted.

- [ ] **Step 6: Verify everything is clean**

```bash
npm run lint && npm run typecheck && npm run build
```

Expected: all three exit 0. If a domain rule flags real code, fix the code — do not disable the rule to make the command pass. If a rule is genuinely wrong for this project, disable it in `biome.json` with a comment saying why.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "P1.T3: Biome replacing ESLint and Prettier"
```

---

## Task 4: Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `lib/utils/cn.ts`, `lib/utils/cn.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run test`, and `cn(...)` — the class-merging helper every component will use for conditional Tailwind classes.

The smoke test is a real utility rather than `expect(true).toBe(true)`, so the harness is proven against code that ships.

- [ ] **Step 1: Install**

```bash
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm i clsx tailwind-merge
```

- [ ] **Step 2: Config**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs live in e2e/ and are run by Playwright, not Vitest.
    exclude: ['node_modules', '.next', 'e2e'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Write the failing test**

`lib/utils/cn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind classes in favour of the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
```

The third case is the reason `tailwind-merge` is a dependency rather than a plain join: conditional styling produces conflicting utilities constantly, and last-wins is not what raw string concatenation gives.

- [ ] **Step 4: Run it and watch it fail**

```bash
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
npm run test
```

Expected: FAIL — `Cannot find module './cn'`.

- [ ] **Step 5: Implement**

`lib/utils/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names, with later Tailwind utilities overriding earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 6: Run it and watch it pass**

```bash
npm run test
```

Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "P1.T4: Vitest and the cn class helper"
```

---

## Task 5: Playwright, asserting the layer contract

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: the probe page from T2 Step 6.
- Produces: `npm run test:e2e`.

- [ ] **Step 1: Install**

```bash
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Config**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Write the failing test**

`e2e/smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('the page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Cinemadraft' })).toBeVisible();
});

test('MUI component styling survives Tailwind preflight', async ({ page }) => {
  await page.goto('/');
  const bg = await page
    .getByTestId('mui-button')
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  // Preflight sets buttons transparent. A themed background proves the mui
  // layer is ordered above base.
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(bg).not.toBe('transparent');
});

test('a Tailwind utility overrides MUI', async ({ page }) => {
  await page.goto('/');
  const bg = await page
    .getByTestId('tailwind-wins')
    .evaluate((el) => getComputedStyle(el).backgroundColor);

  // bg-black beating MUI's contained background proves the mui layer is
  // ordered below utilities.
  expect(bg).toBe('rgb(0, 0, 0)');
});
```

- [ ] **Step 4: Run and confirm all three pass**

```bash
npm pkg set scripts.test:e2e="playwright test"
npm run test:e2e
```

Expected: 3 passed. If test 2 fails, `mui` is ordered below `base`. If test 3 fails, `mui` is above `utilities` or `enableCssLayer` is missing — fix `globals.css` or `providers.tsx`, do not weaken the test.

- [ ] **Step 5: Ignore Playwright output**

```bash
printf '\n/test-results\n/playwright-report\n/blob-report\n' >> .gitignore
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "P1.T5: Playwright, asserting the MUI/Tailwind layer contract"
```

---

## Task 6: CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `lint`, `typecheck`, `test`, `build`, `test:e2e`.

- [ ] **Step 1: Workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: npm

      - run: npm ci

      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

No database service is declared: nothing in this phase touches Postgres, and adding an unused container would slow every run. Phase 2 adds it alongside the first repository test.

- [ ] **Step 2: Verify the whole gate locally first**

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e
```

Expected: all green. CI reproduces this; it should not be the place you discover a failure.

- [ ] **Step 3: Commit and confirm the run passes**

```bash
git add -A && git commit -m "P1.T6: GitHub Actions CI"
git push
gh run watch
```

---

## Task 7: Directory skeleton

**Files:**
- Create: the tree from spec §5, each leaf holding `.gitkeep`

- [ ] **Step 1: Create it**

```bash
mkdir -p \
  "app/(marketing)" \
  "app/(app)/films" \
  "app/(app)/award-shows/[abbr]" \
  "app/(app)/leagues/[id]/draft" \
  "app/(app)/live/[abbr]" \
  app/api/webhooks/clerk \
  "app/api/live/[event]/stream" \
  "app/api/ical/[...slug]" \
  lib/repositories lib/services lib/external lib/utils \
  actions components theme

find app/\(marketing\) app/\(app\) app/api lib actions components -type d -empty \
  -exec touch {}/.gitkeep \;
```

Quoting matters — the parentheses in route groups and the brackets in dynamic segments are shell metacharacters.

- [ ] **Step 2: Confirm the build still passes**

```bash
npm run build
```

Empty route-group directories must not produce routes. Expected: the route list is unchanged from T2.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "P1.T7: directory skeleton per spec section 5"
```

---

## Task 8: Local Postgres in Docker

**Files:**
- Create: `docker-compose.local.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run db:up`, `npm run db:down`, `npm run db:psql`, and a `DATABASE_URL` for local development.

Postgres 17 matches Neon's 17.10, so local and deployed behaviour agree. Per the global constraint, this container is the only Postgres on the machine — the `libpq` tools are clients only.

- [ ] **Step 1: Compose file**

`docker-compose.local.yml`:

```yaml
# Local development and test database. Neon is Preview/Production only —
# local shells and tests must never point at it.
services:
  postgres:
    image: postgres:17
    container_name: cinemadraft-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: cinemadraft
      POSTGRES_PASSWORD: local
      POSTGRES_DB: cinemadraft
    ports:
      - '5433:5432'
    volumes:
      - cinemadraft-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U cinemadraft -d cinemadraft']
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  cinemadraft-pgdata:
```

Port 5433, not 5432, so this cannot collide with anything already bound on the default port. The credentials are deliberately trivial — this container holds no production data and is never exposed beyond localhost.

- [ ] **Step 2: Scripts**

```bash
npm pkg set scripts.db:up="docker compose -f docker-compose.local.yml up -d --wait"
npm pkg set scripts.db:down="docker compose -f docker-compose.local.yml down"
npm pkg set scripts.db:psql="psql postgresql://cinemadraft:local@localhost:5433/cinemadraft"
```

`--wait` blocks until the healthcheck passes, so `db:up` returning means the database is actually accepting connections.

- [ ] **Step 3: Bring it up and confirm it is reachable**

```bash
npm run db:up
psql postgresql://cinemadraft:local@localhost:5433/cinemadraft -c "select version();"
```

Expected: PostgreSQL 17.x. If `psql` is not found, use `$(brew --prefix libpq)/bin/psql` — the Homebrew `libpq` keg is not symlinked into the default path.

- [ ] **Step 4: Record the local connection string**

Append to `.env.local` (gitignored):

```
DATABASE_URL="postgresql://cinemadraft:local@localhost:5433/cinemadraft"
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "P1.T8: local Postgres 17 in Docker"
```

---

## Task 9: Vercel preview deploy

**Files:**
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Deploy a preview**

```bash
vercel --yes
```

Expected: a preview URL that loads the probe page with both buttons rendered as they are locally.

- [ ] **Step 2: Confirm the deployed build used Node 24**

Check the build log for the Node version. It must be 24 — matching `.nvmrc`, `engines`, and the Vercel project setting. A mismatch here surfaces as a runtime failure much later, so catch it now.

- [ ] **Step 3: Tick Phase 1 and record what the scaffold pinned**

Update `docs/PROGRESS.md`: tick P1.T1–T9, and note the resolved versions of Next, React, MUI, and Tailwind under Phase 1 notes so Phase 2 and 3 do not have to re-derive them.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "P1.T9: first Vercel preview deploy green"
```

---

## Phase gate

All of these must be demonstrably true, by running them rather than by inspection:

```bash
npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e
npm run db:up && psql postgresql://cinemadraft:local@localhost:5433/cinemadraft -c "select 1;"
```

- [ ] Every command above exits 0
- [ ] CI is green on `main`
- [ ] The Vercel preview URL loads, built on Node 24
- [ ] `git check-ignore .local/prod-dump.dump .env.local` reports both as ignored
- [ ] The three Playwright assertions pass — in particular the two that pin the cascade layer order, which is the one piece of this phase that later phases cannot easily repair
