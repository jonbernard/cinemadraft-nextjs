// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { loadFixture } from '@/test/fixtures';
import { countQueries } from '@/test/query-count';
import {
  loadDraftedProgress,
  loadNominatedProgress,
  loadShowProgress,
  loadWatchedFilms,
} from './watchlist';

/**
 * The watchlist read against the restored data, compared with the four
 * responses captured from the live API for the same user and season.
 *
 * `*.production.test.ts` because CI has the schema and none of the rows;
 * `vitest.ci.config.mts` excludes it by name.
 */

afterAll(async () => {
  await db.$disconnect();
});

const USER = 3;
const YEAR = 2025;

type Totals = { count: number; total: number };
type FixtureAwards = Record<string, { totals: { nominations: Totals; movies: Totals } }>;
type FixtureNoms = {
  movies: { movieId: number; count: number }[];
  totals: Totals;
};
type FixtureDrafts = Record<string, { movieId: number; watchlistId?: number }[]>;
type FixturePage = { pagination: { count: number; page: number; pageCount: number } };

const awardsFixture = loadFixture<FixtureAwards>('watchlist-awards');
const nomsFixture = loadFixture<FixtureNoms>('watchlist-noms');
const draftsFixture = loadFixture<FixtureDrafts>('watchlist-drafts');
const pageFixture = loadFixture<FixturePage>('watchlist-paged');

describe('loadShowProgress', () => {
  it('reports the totals the source API computed, show for show', async () => {
    const shows = await loadShowProgress(USER, YEAR);
    const byName = new Map(shows.map((show) => [show.show, show]));

    expect(shows).toHaveLength(Object.keys(awardsFixture).length);
    for (const [name, fixture] of Object.entries(awardsFixture)) {
      expect(byName.get(name)).toMatchObject({
        seenNominations: fixture.totals.nominations.count,
        nominations: fixture.totals.nominations.total,
        seenFilms: fixture.totals.movies.count,
        films: fixture.totals.movies.total,
      });
    }
  });

  it('costs one query for the whole season', async () => {
    // 526 nominees across twelve shows. Per-show or per-film would be the
    // N+1 that D59 exists to catch.
    const { queries } = await countQueries(() => loadShowProgress(USER, YEAR));
    expect(queries).toBe(1);
  });
});

describe('loadNominatedProgress', () => {
  it('reports the counts and the seen total the source API did', async () => {
    const progress = await loadNominatedProgress(USER, YEAR);

    expect(progress.total).toBe(nomsFixture.totals.total);
    expect(progress.seen).toBe(nomsFixture.totals.count);

    const counts = new Map(
      progress.films.map((film) => [film.movieId, film.nominations]),
    );
    for (const movie of nomsFixture.movies) {
      expect(counts.get(movie.movieId)).toBe(movie.count);
    }
  });

  it('costs one query', async () => {
    const { queries } = await countQueries(() => loadNominatedProgress(USER, YEAR));
    expect(queries).toBe(1);
  });
});

describe('loadDraftedProgress', () => {
  it('returns each league the member holds a seat in, with what it drafted', async () => {
    const leagues = await loadDraftedProgress(USER, YEAR);
    const byName = new Map(leagues.map((league) => [league.league, league]));

    for (const [name, films] of Object.entries(draftsFixture)) {
      const league = byName.get(name);
      expect(league?.total).toBe(films.length);
      expect(league?.seen).toBe(films.filter((f) => f.watchlistId !== undefined).length);
    }
  });

  it('costs one query', async () => {
    const { queries } = await countQueries(() => loadDraftedProgress(USER, YEAR));
    expect(queries).toBe(1);
  });
});

describe('loadWatchedFilms', () => {
  it('pages exactly as the captured response did', async () => {
    const page = await loadWatchedFilms({
      userId: USER,
      page: 1,
      sortBy: 'releaseDate',
      direction: 'asc',
    });

    expect(page.count).toBe(pageFixture.pagination.count);
    expect(page.pageCount).toBe(pageFixture.pagination.pageCount);
    expect(page.films.length).toBeGreaterThan(0);
    expect(page.films.every((film) => film.watched)).toBe(true);
  });

  it('costs three queries however long the page is', async () => {
    // The count, the page, and one batch for the movies behind it.
    const { queries } = await countQueries(() =>
      loadWatchedFilms({ userId: USER, page: 1, sortBy: 'createdAt', direction: 'desc' }),
    );
    expect(queries).toBe(3);
  });
});
