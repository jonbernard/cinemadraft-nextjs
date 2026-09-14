// @vitest-environment node
//
// The Vitest default environment is jsdom, which is wrong for anything holding
// a socket. Every database test needs this pragma.

import { afterAll, describe, expect, it } from 'vitest';

import { db } from './db';

afterAll(async () => {
  await db.$disconnect();
});

describe('db', () => {
  it('connects to a local Docker database, not Neon', () => {
    // A test that reaches Neon is a bug: Neon holds the only restored copy of
    // production data, and the suite would be mutating it.
    //
    // 🔴 **Any local agent port, and explicitly NOT 5432.**
    //
    // This used to read `543[34]`, naming the two shared databases agents took
    // turns on. That made the ceiling of two a property of a TEST rather than
    // of the machine: provisioning a third was not enough, because this
    // assertion failed on it and the failure read as "the new database is
    // broken". `scripts/agent-up.sh` now gives every agent its own on the
    // first free port from 5440, so the rule is stated as the rule — a local
    // Docker database that is neither the owner's nor Neon.
    //
    // 5432 is `cinemadraft-postgres`, which `next dev` reads through
    // `.env.local` and which holds leagues the owner made by hand and a real
    // Clerk claim. A suite pointed there mutates what they are looking at, and
    // their ordinary use of the product turns exact row counts red — which
    // cost a full suite run to diagnose on 2026-09-13 and is why the databases
    // were separated at all. `playwright.config.mts` refuses it too, at config
    // load, because the browser specs write before this test ever runs.
    const url = process.env.DATABASE_URL ?? '';
    expect(url).toMatch(/localhost:(543[3-9]|54[4-9]\d|5[5-9]\d\d)\b/);
    expect(url).not.toMatch(/localhost:5432\b/);
    expect(url).not.toContain('neon.tech');
  });

  it('reads the restored production data', async () => {
    // 🔴 Counted excluding anything a test created.
    //
    // These are exact counts from the restore, and they are worth asserting
    // exactly — a silent partial restore is precisely what they catch. But the
    // E2E suite registers **real** accounts and creates leagues and films, so
    // a bare `count()` here fails whenever a browser run has just finished or
    // its teardown raced a request still in flight. That is a flake in the
    // check, not a fault in the data, and it trained the eye to ignore a red
    // suite.
    //
    // Test fixtures are identifiable by construction: E2E addresses carry
    // `+clerk_test`, seeded rows carry `@example.test`, and scratch films and
    // leagues are prefixed with their spec's tag.
    expect(
      await db.movie.count({ where: { NOT: { title: { contains: 'e2e-' } } } }),
    ).toBe(1355);
    expect(
      await db.user.count({
        where: {
          AND: [
            { NOT: { email: { contains: '+clerk_test' } } },
            { NOT: { email: { contains: '@example.test' } } },
          ],
        },
      }),
    ).toBe(60);
    expect(await db.nomination.count()).toBe(4559);
  });

  it('exposes PascalCase models mapped to snake_case tables', async () => {
    // The point of this one is the *mapping*, not the numbers, so it asks
    // whether each model reaches its table at all — which is what a broken
    // `@@map` would break. Exact counts would make it another thing E2E
    // residue can turn red.
    expect(await db.availableYear.count()).toBe(10);
    expect(await db.draftPick.count()).toBeGreaterThanOrEqual(1025);
    expect(await db.profileFeed.count()).toBe(125);
  });

  it('maps camelCase fields to snake_case columns', async () => {
    const movie = await db.movie.findFirst({ where: { tmdbId: '313369' } });
    expect(movie?.title).toBe('La La Land');
    expect(movie?.sortTitle).toBe('La La Land');
    expect(movie?.releaseDate).toBeInstanceOf(Date);
  });

  it('round-trips enums', async () => {
    const league = await db.league.findFirst({ where: { draftingStatus: 'complete' } });
    expect(league?.draftingStatus).toBe('complete');
  });

  it('returns bigint columns as bigint', async () => {
    // watchlists.movie_id is bigint while movies.id is integer — a real
    // inconsistency in the source schema that repositories have to handle.
    const watchlist = await db.watchlist.findFirst({ where: { movieId: { not: null } } });
    expect(typeof watchlist?.movieId).toBe('bigint');
  });
});
