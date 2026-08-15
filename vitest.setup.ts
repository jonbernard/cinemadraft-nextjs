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

/**
 * 🔴 No test reaches TMDB by accident.
 *
 * `.env.local` carries a real `TMDB_API_KEY`, and search now consults TMDB on
 * every query (D56) — so loading the env above quietly turned nine existing
 * tests into live network calls the moment a key was supplied. One of them
 * started failing immediately, and the rest were slower, flakier and spending
 * quota; worse, the suite had begun behaving differently depending on whether
 * the developer running it happened to have a key.
 *
 * Clearing it here makes the default deterministic and offline: `searchTmdb`
 * returns nothing without a key, so a test that does not care about TMDB gets
 * local results and no socket. The tests that *are* about TMDB set the
 * variable themselves and stub `fetch` — `lib/external/tmdb.test.ts` and
 * `lib/services/film-ingest.test.ts` both do, which is why they still pass.
 *
 * Deliberately after `config()`, so it wins regardless of what the env holds.
 */
delete process.env.TMDB_API_KEY;
