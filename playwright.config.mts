import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Playwright does not read .env files the way Next does. Without this the
// Clerk keys are absent in the test process and the auth specs skip
// themselves — a green run that proved nothing.
loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

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
  },
});
