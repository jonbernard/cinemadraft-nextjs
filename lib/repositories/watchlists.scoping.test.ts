// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';

import { watchlistRepository } from './watchlists';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The ownership scoping on the three progress reads (step 4).
 *
 * 🔴 Seeded rows, never the restored ones. The scoping is the security claim
 * this whole task turns on — the source's `Watchlist.getByAwards` validated
 * that *a* user was signed in and then filtered by none, so it answered with
 * every user's rows — and a claim that only runs on one developer's laptop
 * against a database CI does not have is not a claim anyone is checking.
 * `watchlists.test.ts` holds the fixture comparisons and stays excluded from
 * CI; this file seeds everything it touches and runs on every push.
 *
 * `SEASON` is a year no restored row uses, so the reads below see exactly what
 * is seeded here and nothing else.
 */
const SEASON = 2097;

let owner = 0;
let stranger = 0;
let movieId = 0;
let leagueId = 0;
let eventId = 0;
let awardId = 0;
let draftIds: number[] = [];

async function createUser(): Promise<number> {
  const now = new Date();
  const user = await db.user.create({
    data: {
      uuid: crypto.randomUUID(),
      email: `watchlist-scoping-${crypto.randomUUID().slice(0, 8)}@example.test`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  return user.id;
}

beforeAll(async () => {
  const now = new Date();

  owner = await createUser();
  stranger = await createUser();

  const movie = await db.movie.create({
    data: {
      title: 'The Scoping Picture',
      sortTitle: 'Scoping Picture',
      tmdbId: `scoping-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  movieId = movie.id;

  const event = await db.event.create({
    data: {
      name: 'Scoping Awards',
      abbreviation: 'SCOPE',
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  eventId = event.id;

  const award = await db.award.create({
    data: {
      name: 'Best Picture',
      eventId: BigInt(event.id),
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  awardId = award.id;

  await db.nomination.create({
    data: {
      movieId: BigInt(movieId),
      awardId: BigInt(awardId),
      year: SEASON,
      createdAt: now,
      updatedAt: now,
    },
  });

  const league = await db.league.create({
    data: {
      name: 'Scoping League',
      owner: String(owner),
      activeYear: SEASON,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  leagueId = league.id;

  // Two seats in the one league, and both of them take the same film. Only a
  // seat belonging to `owner` exists in any league, so `stranger` holds none.
  const seats = await Promise.all(
    [owner, stranger].map((userId, index) =>
      db.draft.create({
        data: {
          userId: index === 0 ? userId : null,
          leagueId,
          year: SEASON,
          group: 1,
          order: index + 1,
          dummy: index === 1,
          dummyName: index === 1 ? 'Empty seat' : null,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true },
      }),
    ),
  );
  draftIds = seats.map((seat) => seat.id);

  for (const [index, seat] of seats.entries()) {
    await db.draftPick.create({
      data: {
        draftId: seat.id,
        movieId: BigInt(movieId),
        order: index + 1,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await db.watchlist.create({
    data: {
      userId: BigInt(owner),
      movieId: BigInt(movieId),
      createdAt: now,
      updatedAt: now,
    },
  });
});

afterAll(async () => {
  await db.watchlist.deleteMany({
    where: { userId: { in: [BigInt(owner), BigInt(stranger)] } },
  });
  await db.draftPick.deleteMany({ where: { draftId: { in: draftIds } } });
  await db.draft.deleteMany({ where: { id: { in: draftIds } } });
  await db.league.deleteMany({ where: { id: leagueId } });
  await db.nomination.deleteMany({ where: { year: SEASON } });
  await db.award.deleteMany({ where: { id: awardId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.movie.deleteMany({ where: { id: movieId } });
  await db.user.deleteMany({ where: { id: { in: [owner, stranger] } } });
});

describe('findNomineeProgressByUser', () => {
  it('marks the nominee for the reader who watched it', async () => {
    const rows = await watchlistRepository.findNomineeProgressByUser(owner, SEASON);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.movieId).toBe(movieId);
    expect(rows[0]?.watched).toBe(true);
  });

  it('🔴 shows another reader the same nominee unwatched', async () => {
    const rows = await watchlistRepository.findNomineeProgressByUser(stranger, SEASON);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.movieId).toBe(movieId);
    expect(rows[0]?.watched).toBe(false);
  });
});

describe('findNominatedFilmProgressByUser', () => {
  it('🔴 does not leak the owner’s mark to another reader', async () => {
    const mine = await watchlistRepository.findNominatedFilmProgressByUser(owner, SEASON);
    const theirs = await watchlistRepository.findNominatedFilmProgressByUser(
      stranger,
      SEASON,
    );

    expect(mine.map((row) => row.watched)).toEqual([true]);
    expect(theirs.map((row) => row.watched)).toEqual([false]);
  });
});

describe('findDraftedFilmProgressByUser', () => {
  it('returns the league the reader holds a seat in', async () => {
    const rows = await watchlistRepository.findDraftedFilmProgressByUser(owner, SEASON);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.leagueId).toBe(leagueId);
    expect(rows[0]?.movieId).toBe(movieId);
    expect(rows[0]?.watched).toBe(true);
  });

  it('🔴 returns nothing to someone who holds no seat', async () => {
    expect(
      await watchlistRepository.findDraftedFilmProgressByUser(stranger, SEASON),
    ).toEqual([]);
  });

  it('lists a film once per league even though two seats took it', async () => {
    // Both seeded seats picked `movieId`; without the group-by this is two rows.
    const rows = await watchlistRepository.findDraftedFilmProgressByUser(owner, SEASON);

    expect(rows.map((row) => `${row.leagueId}:${row.movieId}`)).toEqual([
      `${leagueId}:${movieId}`,
    ]);
  });
});
