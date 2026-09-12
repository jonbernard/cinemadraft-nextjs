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
 * A literal default because this is a local, non-deployed run by construction:
 * `lib/test-auth.ts` refuses to load at all if `VERCEL_ENV` is set. CI
 * generates a real one and exports it before this file is read.
 */
process.env.E2E_TEST_AUTH_SECRET ??= 'local-e2e-secret-at-least-32-chars';

export default defineConfig({
  testDir: './e2e',
  // Runs after every browser has closed. The specs create real accounts, and a
  // request in flight can re-provision one after a spec's own teardown — see
  // the file for what that broke.
  globalTeardown: './e2e/global-teardown.ts',
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
    // Production build, not `next dev`. Dev mode injects extra styling and
    // does not exercise the same CSS pipeline, and the layer-order assertions
    // below are specifically about compiled output.
    //
    // 🔴 `KEEP_TEST_IDS=1` is what makes `data-testid` survive that build.
    // `next.config.ts` strips the attribute from production output, and this is
    // the one build where it must not — remove this and every testid selector in
    // the suite fails with a locator that matches nothing.
    command: 'KEEP_TEST_IDS=1 npm run build && npm run start',
    url: 'http://localhost:3000',
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
