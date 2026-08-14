// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { winnerRepository } from './winners';

afterAll(async () => {
  await db.$disconnect();
});

/** A winner as `GET /winners` returned it, with its two nested associations. */
type FixtureWinner = {
  id: number;
  fbId: string | null;
  movieId: number;
  awardId: number;
  nominationId: number;
  year: number;
  createdAt: string | null;
  updatedAt: string | null;
  movie: { id: number; title: string | null } | null;
  award: { id: number; points: number | null } | null;
};

const winners = loadFixture<FixtureWinner[]>('winners');

const first = winners[0];
if (!first) throw new Error('winners fixture is empty');

const YEAR = 2025;

describe('winnerRepository.findById', () => {
  it('returns the winner', async () => {
    const winner = await winnerRepository.findById(first.id);
    expect(winner.awardId).toBe(first.awardId);
    expect(winner.year).toBe(first.year);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(winnerRepository.findById(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(winnerRepository.findById(999_999)).rejects.toThrow(
      'winner 999999 not found',
    );
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const winner = await winnerRepository.findById(first.id);

    // `movie` and `award` are dropped: the schema declares no relations, so
    // composing them is the service layer's job. See the join-bug test below
    // for why reproducing the nested `movie` would have been actively wrong.
    expect(Object.keys(winner).sort()).toEqual(
      Object.keys(first)
        .filter((k) => k !== 'movie' && k !== 'award')
        .sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const winner = await winnerRepository.findById(first.id);

    expect(winner.id).toBe(first.id);
    expect(winner.fbId).toBe(first.fbId);
    expect(winner.movieId).toBe(first.movieId);
    expect(winner.awardId).toBe(first.awardId);
    expect(winner.nominationId).toBe(first.nominationId);
    expect(winner.year).toBe(first.year);
    expect(winner.createdAt?.toISOString()).toBe(first.createdAt);
  });

  it('keeps year as a number, because the column is integer', async () => {
    // winners.year is `integer` while nominations.year is `text`. The two
    // tables genuinely disagree, and each DTO reports its own column honestly
    // rather than inventing a shared type that matches neither.
    const winner = await winnerRepository.findById(first.id);
    expect(typeof winner.year).toBe('number');
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const winner = await winnerRepository.findById(first.id);
    expect(winner.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const winner = await winnerRepository.findById(first.id);
    expect(Object.getPrototypeOf(winner)).toBe(Object.prototype);
  });
});

describe('the captured `movie` association is a source-app bug', () => {
  it('returns the movie_id the row actually stores', async () => {
    // The fixture nests `movie: { id: 1, title: "Arrival" }` under a winner
    // whose movie_id is 675. That is not our data being odd — the source app
    // declared `Winners.hasOne(Movies, { foreignKey: 'id' })` with no
    // `sourceKey` (server/models/winners.js), so Sequelize joined
    // movies.id = winners.id, the winner's own primary key, instead of
    // winners.movie_id. It matches for 722 of 734 rows only because both
    // sequences happen to run in step, and 12 rows nest `null` where the
    // winner id runs past the end of the movies table.
    //
    // This one is not recorded in docs/PROGRESS.md yet. Correct behaviour
    // wins: the DTO reports movie_id, and any join the service layer builds
    // goes through movie_id.
    const winner = await winnerRepository.findById(first.id);

    expect(winner.movieId).toBe(first.movieId);
    expect(winner.movieId).not.toBe(first.movie?.id);
    expect(first.movie?.id).toBe(first.id);
  });

  it('holds across the whole capture, so it is systematic and not one bad row', async () => {
    const nested = winners.filter((w) => w.movie);
    const matchesWinnerId = nested.filter((w) => w.movie?.id === w.id).length;
    const matchesMovieId = nested.filter((w) => w.movie?.id === w.movieId).length;

    expect(matchesWinnerId).toBe(nested.length);
    expect(matchesMovieId).toBeLessThan(nested.length);
    // The nulls are the winners whose id exceeds the largest movie id.
    expect(winners.length - nested.length).toBeGreaterThan(0);
  });

  it('never dangles on movie_id, unlike the join the source app used', async () => {
    const [row] = await db.$queryRaw<{ count: bigint }[]>`
      select count(*) as count from winners w
      where not exists (select 1 from movies m where m.id = w.movie_id)
    `;

    expect(Number(row?.count)).toBe(0);
  });
});

describe('bigint hygiene', () => {
  it('returns movieId, awardId and nominationId as numbers', async () => {
    // All three are bigint against integer movies.id, awards.id and
    // nominations.id. A win doubles its award's points, so these rows go
    // through the scoring path and get serialized on the way out.
    const winner = await winnerRepository.findById(first.id);

    expect(typeof winner.movieId).toBe('number');
    expect(typeof winner.awardId).toBe('number');
    expect(typeof winner.nominationId).toBe('number');
  });

  it('survives JSON.stringify across the whole table', async () => {
    const all = await winnerRepository.findAll();
    expect(() => JSON.stringify(all)).not.toThrow();
  });
});

describe('winnerRepository.findAll', () => {
  it('returns every winner, ordered by id', async () => {
    const all = await winnerRepository.findAll();

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from winners order by id asc
    `;

    expect(all.map((w) => w.id)).toEqual(ordered.map((r) => r.id));
    expect(all).toHaveLength(winners.length);
  });
});

describe('winnerRepository.findByYear', () => {
  it('returns every winner for the year', async () => {
    const found = await winnerRepository.findByYear(YEAR);
    const expected = winners.filter((w) => w.year === YEAR);

    expect(found).toHaveLength(expected.length);
    expect(found.every((w) => w.year === YEAR)).toBe(true);
  });

  it('returns an empty array for a year with no winners', async () => {
    // Legitimate: the ceremony has not happened yet.
    expect(await winnerRepository.findByYear(1901)).toEqual([]);
  });
});

describe('winnerRepository.findByAwardIdAndYear', () => {
  it('returns the single winner of an award in a year', async () => {
    // (award_id, year) is the natural key: the source app upserted on it and
    // deleted by it (server/controllers/winners.js), and no pair repeats in
    // the table. This is the lookup the scoring path needs — "did this movie
    // win this award?" — and it must not have to scan a year to answer.
    const expected = winners.find((w) => w.year === YEAR);
    if (!expected) throw new Error('winners fixture has no rows for the year');

    const winner = await winnerRepository.findByAwardIdAndYear(expected.awardId, YEAR);

    expect(winner?.id).toBe(expected.id);
    expect(winner?.movieId).toBe(expected.movieId);
  });

  it('is unique in the data, so returning one row is honest', async () => {
    const duplicates = await db.$queryRaw<{ award_id: bigint }[]>`
      select award_id from winners group by award_id, year having count(*) > 1
    `;

    expect(duplicates).toEqual([]);
  });

  it('returns null when the award has no winner that year', async () => {
    // Not an error: an award that has not been announced yet has no winner,
    // and the scoring path asks this question of every nomination.
    expect(await winnerRepository.findByAwardIdAndYear(62, 1901)).toBeNull();
  });

  it('accepts the bigint ids that other tables store', async () => {
    const expected = winners.find((w) => w.year === YEAR);
    if (!expected) throw new Error('winners fixture has no rows for the year');

    const winner = await winnerRepository.findByAwardIdAndYear(
      BigInt(expected.awardId),
      YEAR,
    );
    expect(winner?.id).toBe(expected.id);
  });
});

describe('winnerRepository.findManyByAwardIds', () => {
  it('returns the winners for the requested awards', async () => {
    const winner = await winnerRepository.findManyByAwardIds([62]);
    expect(winner.length).toBeGreaterThan(0);
    expect(winner.every((w) => w.awardId === 62)).toBe(true);
  });

  it('narrows to a single year when asked', async () => {
    const found = await winnerRepository.findManyByAwardIds([62], YEAR);
    expect(found).toHaveLength(1);
    expect(found[0]?.year).toBe(YEAR);
  });

  it('accepts the bigint ids that other tables store', async () => {
    const found = await winnerRepository.findManyByAwardIds([62n], YEAR);
    expect(found).toHaveLength(1);
  });

  it('silently skips award ids that resolve to nothing', async () => {
    expect(await winnerRepository.findManyByAwardIds([999_999])).toEqual([]);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await winnerRepository.findManyByAwardIds([])).toEqual([]);
  });
});

describe('winnerRepository.findManyByMovieIds', () => {
  it('returns the wins for the requested movies', async () => {
    // The scoring path starts from a draft's picks. A win scores its award's
    // points a second time, so this is the second half of that query.
    const expected = winners.filter((w) => w.movieId === first.movieId);

    const found = await winnerRepository.findManyByMovieIds([first.movieId]);

    expect(found).toHaveLength(expected.length);
    expect(found.every((w) => w.movieId === first.movieId)).toBe(true);
  });

  it('narrows to a single year when asked', async () => {
    const found = await winnerRepository.findManyByMovieIds([first.movieId], first.year);
    expect(found.every((w) => w.year === first.year)).toBe(true);
    expect(found.length).toBeGreaterThan(0);
  });

  it('accepts the bigint ids that other tables store', async () => {
    const found = await winnerRepository.findManyByMovieIds([BigInt(first.movieId)]);
    expect(found.length).toBeGreaterThan(0);
  });

  it('silently skips movie ids that resolve to nothing', async () => {
    expect(await winnerRepository.findManyByMovieIds([999_999])).toEqual([]);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await winnerRepository.findManyByMovieIds([])).toEqual([]);
  });
});

describe('winnerRepository.findManyByIds', () => {
  it('returns the requested winners', async () => {
    const ids = winners.slice(0, 3).map((w) => w.id);
    const found = await winnerRepository.findManyByIds(ids);
    expect(found.map((w) => w.id)).toEqual(ids);
  });

  it('silently skips ids that do not exist', async () => {
    const found = await winnerRepository.findManyByIds([first.id, 999_999]);
    expect(found).toHaveLength(1);
  });

  it('accepts bigint ids', async () => {
    const found = await winnerRepository.findManyByIds([BigInt(first.id)]);
    expect(found).toHaveLength(1);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await winnerRepository.findManyByIds([])).toEqual([]);
  });
});
