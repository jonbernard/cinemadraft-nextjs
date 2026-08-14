// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { movieRepository } from './movies';

afterAll(async () => {
  await db.$disconnect();
});

/** A movie as the source API nested it inside winners, lists and picks. */
type FixtureMovie = {
  id: number;
  title: string | null;
  sortTitle: string | null;
  fbId: string | null;
  imdbId: string | null;
  tmdbId: string | null;
  poster: string | null;
  backdrop: string | null;
  releaseDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const winners = loadFixture<{ movie: FixtureMovie }[]>('winners');

describe('movieRepository.findById', () => {
  it('returns the movie', async () => {
    const movie = await movieRepository.findById(1);
    expect(movie.title).toBe('Arrival');
    expect(movie.tmdbId).toBe('329865');
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    // Repositories never return null for a by-id lookup: every caller would
    // have to null-check, and most would forget.
    await expect(movieRepository.findById(999_999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(movieRepository.findById(999_999)).rejects.toThrow(
      'movie 999999 not found',
    );
  });
});

describe('movieRepository.findByTmdbId', () => {
  it('returns the movie', async () => {
    const movie = await movieRepository.findByTmdbId('313369');
    expect(movie?.title).toBe('La La Land');
  });

  it('returns null when absent', async () => {
    // Unlike findById, this one is a lookup that legitimately misses: the
    // search flow asks whether a TMDB movie is known locally yet.
    expect(await movieRepository.findByTmdbId('0')).toBeNull();
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const expected = winners[0]?.movie;
    if (!expected) throw new Error('winners fixture is empty');

    const movie = await movieRepository.findById(expected.id);

    expect(Object.keys(movie).sort()).toEqual(
      [...Object.keys(expected), 'accentHex'].sort(),
    );
  });

  it('matches the captured values field for field', async () => {
    const expected = winners[0]?.movie;
    if (!expected) throw new Error('winners fixture is empty');

    const movie = await movieRepository.findById(expected.id);

    expect(movie.id).toBe(expected.id);
    expect(movie.title).toBe(expected.title);
    expect(movie.sortTitle).toBe(expected.sortTitle);
    expect(movie.tmdbId).toBe(expected.tmdbId);
    expect(movie.imdbId).toBe(expected.imdbId);
    expect(movie.releaseDate?.toISOString()).toBe(expected.releaseDate);
  });

  it('returns bare TMDB paths, not the absolute URLs the API returned', async () => {
    // The source API prepended a base URL fetched from TMDB's /configuration
    // endpoint on every request (server/config/movieImages.js). That base and
    // the size it picks can change without our data changing, so it is a
    // presentation concern — lib/external/tmdb.ts owns it, not this layer.
    const expected = winners[0]?.movie;
    if (!expected) throw new Error('winners fixture is empty');

    const movie = await movieRepository.findById(expected.id);

    expect(movie.poster).toMatch(/^\//);
    expect(movie.poster).not.toContain('image.tmdb.org');
    // The stored path is the tail of the URL the API served.
    expect(expected.poster?.endsWith(movie.poster ?? '')).toBe(true);
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    // The fixture holds ISO strings because it came over HTTP. Repositories
    // return DTOs for server-side use, so dates stay Date until something
    // serializes them.
    const movie = await movieRepository.findById(1);
    expect(movie.releaseDate).toBeInstanceOf(Date);
  });

  it('returns no Prisma internals', async () => {
    const movie = await movieRepository.findById(1);
    expect(Object.getPrototypeOf(movie)).toBe(Object.prototype);
  });
});

describe('movieRepository.search', () => {
  it('matches on title, case-insensitively', async () => {
    const results = await movieRepository.search('la la');
    expect(results.map((m) => m.title)).toContain('La La Land');
  });

  it('orders by sortTitle, using the database collation', async () => {
    // Asserting against a JS sort would be wrong: the database collates
    // en_US.utf8, and JS localeCompare disagrees with it on punctuation and
    // case. Comparing against an explicit SQL ordering checks the repository
    // asked for the right ORDER BY without reimplementing collation here.
    const results = await movieRepository.search('the', 50);

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from movies
      where title ilike ${'%the%'}
      order by sort_title asc
      limit 50
    `;

    expect(results.map((m) => m.id)).toEqual(ordered.map((r) => r.id));
    expect(results.length).toBeGreaterThan(1);
  });

  it('respects the limit', async () => {
    expect(await movieRepository.search('a', 5)).toHaveLength(5);
  });

  it('returns an empty array rather than throwing when nothing matches', async () => {
    expect(await movieRepository.search('zzzzzzzznope')).toEqual([]);
  });
});

describe('movieRepository.findManyByIds', () => {
  it('returns the requested movies', async () => {
    const movies = await movieRepository.findManyByIds([1, 2, 3]);
    expect(movies).toHaveLength(3);
    expect(movies.map((m) => m.id).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('silently skips ids that do not exist', async () => {
    // Callers batch-load by id from other tables, and this schema has no
    // foreign keys — a dangling reference is possible and must not blow up a
    // whole page render.
    const movies = await movieRepository.findManyByIds([1, 999_999]);
    expect(movies).toHaveLength(1);
  });

  it('accepts the bigint ids that other tables store', async () => {
    // movies.id is integer, but draft_picks.movie_id, nominations.movie_id,
    // watchlists.movie_id and winners.movie_id are all bigint.
    const movies = await movieRepository.findManyByIds([1n, 2n]);
    expect(movies).toHaveLength(2);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await movieRepository.findManyByIds([])).toEqual([]);
  });
});
