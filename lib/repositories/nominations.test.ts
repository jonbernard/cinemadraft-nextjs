// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { nominationRepository } from './nominations';

afterAll(async () => {
  await db.$disconnect();
});

/** A nomination as the source API nested it inside the event payload. */
type FixtureNomination = {
  id: number;
  fbId: string | null;
  movieId: number;
  awardId: number;
  year: string | null;
  detailName: string | null;
  detailCharacter: string | null;
  detailId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

/** `/events/oscars/2025` — nominations nested under each award. */
const oscars = loadFixture<{
  awards: { id: number; nominations: (FixtureNomination & { movie: unknown })[] }[];
}>('event-by-abbr-year');

/** `/watchlist/noms/2025` — one row per movie with a nomination count. */
const watchlistNoms = loadFixture<{
  movies: { movieId: number; count: number }[];
  totals: { count: number; total: number };
}>('watchlist-noms');

const YEAR = '2025';

const firstNomination = oscars.awards.find((a) => a.id === 62)?.nominations[0];
if (!firstNomination) throw new Error('oscars fixture is missing award 62');

describe('nominationRepository.findById', () => {
  it('returns the nomination', async () => {
    const nomination = await nominationRepository.findById(firstNomination.id);
    expect(nomination.awardId).toBe(62);
    expect(nomination.year).toBe(YEAR);
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(nominationRepository.findById(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(nominationRepository.findById(999_999)).rejects.toThrow(
      'nomination 999999 not found',
    );
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const nomination = await nominationRepository.findById(firstNomination.id);

    // `movie` is dropped: this schema declares no relations, so joining is the
    // service layer's job. The repository returns rows from one table.
    expect(Object.keys(nomination).sort()).toEqual(
      Object.keys(firstNomination)
        .filter((k) => k !== 'movie')
        .sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const nomination = await nominationRepository.findById(firstNomination.id);

    expect(nomination.id).toBe(firstNomination.id);
    expect(nomination.fbId).toBe(firstNomination.fbId);
    expect(nomination.movieId).toBe(firstNomination.movieId);
    expect(nomination.awardId).toBe(firstNomination.awardId);
    expect(nomination.year).toBe(firstNomination.year);
    expect(nomination.detailName).toBe(firstNomination.detailName);
    expect(nomination.detailCharacter).toBe(firstNomination.detailCharacter);
    expect(nomination.detailId).toBe(firstNomination.detailId);
    expect(nomination.createdAt?.toISOString()).toBe(firstNomination.createdAt);
  });

  it('keeps year as a string, because the column is text', async () => {
    // nominations.year is `text` while every other year column in the schema
    // is `integer` (recorded during introspection). Coercing it to a number
    // here would make the DTO disagree with the value a caller must pass back
    // into findByYear, so the oddity stays visible instead of being papered
    // over halfway down the stack.
    const nomination = await nominationRepository.findById(firstNomination.id);
    expect(typeof nomination.year).toBe('string');
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const nomination = await nominationRepository.findById(firstNomination.id);
    expect(nomination.createdAt).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const nomination = await nominationRepository.findById(firstNomination.id);
    expect(Object.getPrototypeOf(nomination)).toBe(Object.prototype);
  });
});

describe('bigint hygiene', () => {
  it('returns movieId, awardId and detailId as numbers', async () => {
    // movie_id, award_id and detail_id are all bigint here, against integer
    // movies.id and awards.id. A bigint in the DTO would throw the moment
    // anything serialized it, and these rows are the scoring input — they get
    // serialized constantly.
    const nomination = await nominationRepository.findById(firstNomination.id);

    expect(typeof nomination.movieId).toBe('number');
    expect(typeof nomination.awardId).toBe('number');
    expect(nomination.detailId).toBeNull();
  });

  it('returns a number for a populated detailId', async () => {
    const withDetail = await db.$queryRaw<{ id: number }[]>`
      select id from nominations where detail_id is not null order by id asc limit 1
    `;

    if (withDetail.length > 0 && withDetail[0]) {
      const nomination = await nominationRepository.findById(withDetail[0].id);
      expect(typeof nomination.detailId).toBe('number');
    }
  });

  it('survives JSON.stringify across a whole year of rows', async () => {
    const nominations = await nominationRepository.findByYear(YEAR);
    expect(() => JSON.stringify(nominations)).not.toThrow();
  });
});

describe('nominationRepository.findByYear', () => {
  it('returns every nomination for the year', async () => {
    const nominations = await nominationRepository.findByYear(YEAR);

    const [row] = await db.$queryRaw<{ count: bigint }[]>`
      select count(*) as count from nominations where year = ${YEAR}
    `;

    expect(nominations).toHaveLength(Number(row?.count));
    expect(nominations.every((n) => n.year === YEAR)).toBe(true);
  });

  it('orders by id', async () => {
    const nominations = await nominationRepository.findByYear(YEAR);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from nominations where year = ${YEAR} order by id asc
    `;

    expect(nominations.map((n) => n.id)).toEqual(ordered.map((r) => r.id));
  });

  it('returns an empty array for a year with no nominations', async () => {
    // A legitimate miss, not an error: the next season has no nominations
    // until the first announcement.
    expect(await nominationRepository.findByYear('1901')).toEqual([]);
  });
});

describe('nominationRepository.findManyByMovieIds', () => {
  it('returns every nomination for the requested movies', async () => {
    // This is the shape the scoring service needs: it starts from a draft's
    // picks, which are movie ids, and pulls the nominations they earned.
    const nominations = await nominationRepository.findManyByMovieIds([1053, 1054]);

    expect(nominations.length).toBeGreaterThan(0);
    expect(new Set(nominations.map((n) => n.movieId))).toEqual(new Set([1053, 1054]));
  });

  it('silently skips movie ids that resolve to nothing', async () => {
    const both = await nominationRepository.findManyByMovieIds([1053, 999_999]);
    const one = await nominationRepository.findManyByMovieIds([1053]);
    expect(both.map((n) => n.id)).toEqual(one.map((n) => n.id));
  });

  it('accepts the bigint ids that other tables store', async () => {
    const nominations = await nominationRepository.findManyByMovieIds([1053n]);
    expect(nominations.length).toBeGreaterThan(0);
  });

  it('returns an empty array for an empty request', async () => {
    // The source app passed `ids || []` straight into an IN clause. An empty
    // request has to short-circuit rather than become `IN ()`.
    expect(await nominationRepository.findManyByMovieIds([])).toEqual([]);
  });
});

describe('nominationRepository.findManyByAwardIds', () => {
  it('returns every nomination for the requested awards', async () => {
    const expected = oscars.awards.find((a) => a.id === 62);
    if (!expected) throw new Error('oscars fixture is missing award 62');

    const nominations = await nominationRepository.findManyByAwardIds([62]);

    // The fixture holds one year; the table holds every year this award has
    // ever run, so the fixture is a lower bound rather than the count.
    expect(nominations.length).toBeGreaterThanOrEqual(expected.nominations.length);
    expect(nominations.every((n) => n.awardId === 62)).toBe(true);
  });

  it('narrows to a single year when asked', async () => {
    const expected = oscars.awards.find((a) => a.id === 62);
    if (!expected) throw new Error('oscars fixture is missing award 62');

    const nominations = await nominationRepository.findManyByAwardIds([62], YEAR);

    expect(nominations.map((n) => n.id)).toEqual(expected.nominations.map((n) => n.id));
  });

  it('accepts the bigint ids that other tables store', async () => {
    const nominations = await nominationRepository.findManyByAwardIds([62n], YEAR);
    expect(nominations.length).toBeGreaterThan(0);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await nominationRepository.findManyByAwardIds([])).toEqual([]);
  });

  it('silently skips award ids that resolve to nothing', async () => {
    expect(await nominationRepository.findManyByAwardIds([999_999])).toEqual([]);
  });
});

describe('nominationRepository.findManyByIds', () => {
  it('returns the requested nominations', async () => {
    const ids = oscars.awards[0]?.nominations.slice(0, 3).map((n) => n.id) ?? [];
    const nominations = await nominationRepository.findManyByIds(ids);
    expect(nominations).toHaveLength(3);
  });

  it('silently skips ids that do not exist', async () => {
    // winners.nomination_id is bigint against an integer nominations.id, with
    // no foreign key. Deleting a nomination leaves the winner dangling.
    const nominations = await nominationRepository.findManyByIds([15, 999_999]);
    expect(nominations).toHaveLength(1);
  });

  it('accepts the bigint ids that other tables store', async () => {
    const nominations = await nominationRepository.findManyByIds([15n, 17n]);
    expect(nominations).toHaveLength(2);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await nominationRepository.findManyByIds([])).toEqual([]);
  });
});

describe('nominationRepository.countByYear', () => {
  it('counts nominations per movie the way the watchlist did', async () => {
    // /watchlist/noms/:year needs one count per movie. The source app pulled
    // every row for the year and counted them in JS; 4559 rows across the
    // table makes that the wrong side of the wire to count on. Counting is not
    // scoring — no point values are involved — so it belongs here.
    const counts = await nominationRepository.countByYear(YEAR);

    expect(counts).toHaveLength(watchlistNoms.movies.length);

    const byMovie = new Map(counts.map((c) => [c.movieId, c.count]));
    for (const movie of watchlistNoms.movies) {
      expect(byMovie.get(movie.movieId)).toBe(movie.count);
    }
  });

  it('returns movieId as a number', async () => {
    const counts = await nominationRepository.countByYear(YEAR);
    expect(counts.every((c) => typeof c.movieId === 'number')).toBe(true);
    expect(() => JSON.stringify(counts)).not.toThrow();
  });

  it('orders by count descending, then by movieId', async () => {
    const counts = await nominationRepository.countByYear(YEAR);

    const ordered = await db.$queryRaw<{ movie_id: bigint; count: bigint }[]>`
      select movie_id, count(*) as count from nominations
      where year = ${YEAR}
      group by movie_id
      order by count(*) desc, movie_id asc
    `;

    expect(counts.map((c) => c.movieId)).toEqual(ordered.map((r) => Number(r.movie_id)));
  });

  it('returns an empty array for a year with no nominations', async () => {
    expect(await nominationRepository.countByYear('1901')).toEqual([]);
  });
});
