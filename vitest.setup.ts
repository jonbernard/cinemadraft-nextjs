import { cleanup } from '@testing-library/react';
import { config } from 'dotenv';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

/**
 * Unmount between tests.
 *
 * Testing Library registers this automatically, but only when Vitest's
 * `globals` are enabled — and this project runs without them. Without it every
 * `render` accumulates in the same document, so a test asserting an element is
 * *absent* finds the previous test's copy and fails, while a test asserting
 * presence passes for the wrong reason. The second failure mode is the
 * dangerous one, because it is silent.
 */
afterEach(cleanup);

// Vitest does not read .env files the way Next does, so database tests would
// otherwise start with DATABASE_URL unset.
//
// .env.local first and .env second, matching Next's precedence. Both point at
// the local Docker container — Neon is Preview/Production only, and a suite
// pointed at it would be mutating the only restored copy of production data.
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
