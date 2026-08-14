import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ holds Playwright specs, which Playwright runs. Without this
    // exclusion Vitest picks them up and fails on Playwright's globals.
    exclude: ['node_modules', '.next', 'e2e'],

    // One test file at a time. Vitest runs files in parallel by default, and
    // these tests share a single Postgres database — not a fixture each worker
    // can hold its own copy of.
    //
    // The active season is the sharpest case. `available_years_one_active` is
    // a partial unique index, so exactly one row in the entire database may be
    // active; there is no per-worker version of it to isolate. While
    // available-years.test.ts had 2025 temporarily active, schema.test.ts was
    // concurrently asserting that 2026 was active and that flagging 2025 would
    // be rejected. Both failed, in roughly one run out of three.
    //
    // Serializing is the fix rather than a workaround: the invariant under
    // test is global by design, so a test that moves it cannot be isolated,
    // only sequenced. The suite runs in about a second, so the parallelism was
    // buying nothing. Revisit only if that stops being true.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': import.meta.dirname },
  },
});
