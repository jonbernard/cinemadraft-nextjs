import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Playwright does not read .env files the way Next does. Without this the
// Clerk keys are absent in the test process and the auth specs skip
// themselves — a green run that proved nothing.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

/**
 * 🔴 One secret, two processes. `e2e/support/session.ts` signs the cookie in
 * *this* process and the app verifies it in the webServer's, so the value has
 * to be decided here, before either reads it — hand the webServer a different
 * one and every spec fails as "not signed in", which reads as a broken app
 * rather than a broken config.
 *
 * 🔴 Generated per run, never a literal. A committed default is a published
 * signing key: with it, anybody who can reach the e2e server can mint
 * `<id>.<Date.now()>.<hmac>` for any row in the restored local database,
 * including an admin. That the run is local is not the protection people
 * assume — `reuseExistingServer` leaves it up long after the run, so the
 * window is "whenever a developer last ran the suite", not "during it".
 *
 * Still `??=`: the value only ever travels process-to-process (here into
 * `webServer.env` below), so an explicitly supplied one — CI's `openssl rand`
 * — must win. 64 hex characters, twice the 32 the module demands.
 */
process.env.E2E_TEST_AUTH_SECRET ??= randomBytes(32).toString('hex');

/**
 * 🔴 One port per worktree. Two worktrees running the suite at once on a shared
 * 3000 do not fail — `reuseExistingServer` hands the second run the first
 * one's server, so it tests the other checkout's code and, with a different
 * secret, fails every spec as "not signed in". `E2E_PORT` separates them;
 * `e2e/support/session.ts` reads the same variable for the cookie's origin.
 */
const port = process.env.E2E_PORT ?? '3000';

export default defineConfig({
  testDir: './e2e',
  // Runs after every browser has closed. The specs create real accounts, and a
  // request in flight can re-provision one after a spec's own teardown — see
  // the file for what that broke.
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  // 🔴 Four, not the default. Measured 2026-09-12: at the default (7 here) two
  // dashboard specs time out waiting for a `rowheader`, and it is not those
  // specs' fault — a throwaway file of three trivial `/leagues` visits
  // reproduces it exactly, and the whole suite is green serially and at 4. So
  // the ceiling is the app under concurrent load, not a flaky assertion, and
  // the next person to add three tests would have read it as "I broke the
  // dashboard". Raise this only with a measurement that says the ceiling moved.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    /**
     * 🔴 The recording is the artefact the owner reviews (P19.T7), so a paced
     * run records everything and an ordinary run records only what failed.
     *
     * Cost is not the objection — a full 80-spec run recorded 9.1MB of webm on
     * 2026-09-12 — the objection is that eighty videos of a green run are
     * eighty files nobody opens. `retain-on-failure` keeps the debugging value
     * at no cost on green.
     *
     * `DEMO_PACE` is read here, in the test process. The app under test knows
     * nothing about pacing and must not: `webServer.env` is unchanged.
     */
    video: Number(process.env.DEMO_PACE ?? 0) > 0 ? 'on' : 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Production build, not `next dev`. Dev mode injects extra styling and
    // does not exercise the same CSS pipeline, and the layer-order assertions
    // below are specifically about compiled output.
    //
    // 🔴 `KEEP_TEST_IDS=1` is what makes `data-testid` survive that build.
    // `next.config.ts` strips the attribute from production output, and this is
    // the one build where it must not — remove this and every testid selector in
    // the suite fails with a locator that matches nothing.
    //
    // 🔴 `-H 127.0.0.1` is a security control, not a preference. `next start`
    // binds `0.0.0.0`, and under this flag `proxy.ts` installs a pass-through
    // with no route protection at all — so the default put an app that trusts
    // a cookie, and has no auth behind it, on every interface of the machine.
    // Bound to loopback there is nothing for the rest of the network to reach.
    // (`lib/test-auth.ts` refuses a non-loopback `Host` as well; two locks.)
    //
    // The URLs below stay `localhost` deliberately: it resolves to this same
    // listener, and it is the origin `e2e/support/session.ts` pins the session
    // cookie to. Changing one without the other signs nobody in.
    command: `KEEP_TEST_IDS=1 npm run build && npm run start -- -H 127.0.0.1 -p ${port}`,
    // 🔴 `/tokens`, not `/`. The readiness probe asks "is the server up", and
    // `/` is the dashboard: it calls `getActiveYear()`, which THROWS
    // `no seasons exist` against a database with no `available_years` row. On
    // CI — a fresh Postgres with the schema and none of the data — that made
    // every boot answer 500, Playwright polled it for the full 180s, and the
    // run died as "Timed out waiting from config.webServer" without a single
    // spec having started. A probe that can fail for a data reason is not a
    // liveness probe, it is a test nobody wrote down.
    //
    // `/tokens` is the narrowest route that still proves something: it touches
    // no repository, but it renders through the root layout, the providers, the
    // fonts and compiled globals.css, so a 200 here means the app can actually
    // produce HTML. `/robots.txt` would also answer, and answer earlier — which
    // is the problem with it: it is emitted as a static file at build time and
    // would go green for a server whose React runtime is broken.
    //
    // `use.baseURL` deliberately stays `/` — the specs navigate relative to it.
    url: `http://localhost:${port}/tokens`,
    // A server left over from an earlier run holds *that* run's secret, so
    // reuse after the change above fails every spec as "not signed in" rather
    // than as a mismatch. Kill whatever is on the port and run again.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // 🔴 The app under test boots with no Clerk at all (D82/D84). The test
    // session replaces it: `lib/auth.ts` resolves the signed cookie this
    // process writes, `proxy.ts` installs a pass-through instead of
    // `clerkMiddleware`, and `app/providers.tsx` mounts no `ClerkProvider`.
    //
    // The empty publishable key is what drives that last part, and it has to be
    // empty rather than absent: `.env.local` supplies a real one on a developer
    // machine, and `@next/env` only fills a variable that is undefined — an
    // empty string already counts as set, so this wins. Without it the build
    // would mount Clerk's provider around a session Clerk knows nothing about.
    env: {
      E2E_TEST_AUTH: '1',
      E2E_TEST_AUTH_SECRET: process.env.E2E_TEST_AUTH_SECRET,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    },
  },
});
