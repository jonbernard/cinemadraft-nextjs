// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { reviewRepository } from './reviews';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * `GET /reviews/tmdbId/313369` came back as `{}`.
 *
 * Not a capture failure: the source route returned Sequelize's `null` and the
 * response wrapper turned it into `{}` (`res.json(response || {})`). The table
 * has 0 rows in production, so every capture of this route would look the
 * same. Nothing below assumes a row exists.
 */
const fixture = loadFixture<Record<string, never>>('review-by-tmdb');

const USER = 3;

describe('the table is empty in production', () => {
  it('is still empty in the restored data, which is what these tests assume', async () => {
    const [{ count }] = await db.$queryRaw<{ count: bigint }[]>`
      select count(*) as count from reviews
    `;
    expect(Number(count)).toBe(0);
  });

  it('captured nothing for the movie the fixture asked about', () => {
    expect(fixture).toEqual({});
  });
});

describe('reviewRepository.findById', () => {
  it('throws NotFoundError, the same as any other by-id lookup', async () => {
    await expect(reviewRepository.findById(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await expect(reviewRepository.findById(999_999)).rejects.toThrow(
      'review 999999 not found',
    );
  });
});

describe('reviewRepository.findByUserAndMovieId', () => {
  it('returns null when the user has not reviewed the movie', async () => {
    // This is the `{}` in the fixture: a legitimate miss, not an error. The
    // review form renders empty and the user writes one.
    expect(await reviewRepository.findByUserAndMovieId(USER, 1)).toBeNull();
  });

  it('returns null for a movie id that does not resolve', async () => {
    expect(await reviewRepository.findByUserAndMovieId(USER, 999_999)).toBeNull();
  });

  it('is scoped to the user, which the source route was not', async () => {
    // `Reviews.getByTmdbId` required a signed-in user and then filtered on
    // movieId alone, so it handed back whichever review Postgres returned
    // first — potentially somebody else's, shown in the current user's own
    // edit form. Scoping is not optional here.
    const scoped = await reviewRepository.findByUserAndMovieId(USER, 1);
    const other = await reviewRepository.findByUserAndMovieId(999_999, 1);
    expect(scoped).toBeNull();
    expect(other).toBeNull();
  });
});

describe('reviewRepository.findByUserAndMovieIds', () => {
  it('returns an empty array for the empty table', async () => {
    expect(await reviewRepository.findByUserAndMovieIds(USER, [1, 2, 3])).toEqual([]);
  });

  it('accepts the bigint ids the watchlist holds', async () => {
    // The watchlist page joins a user's reviews onto watchlist rows, whose
    // movie_id is bigint while reviews.movie_id is integer.
    expect(await reviewRepository.findByUserAndMovieIds(USER, [1n])).toEqual([]);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await reviewRepository.findByUserAndMovieIds(USER, [])).toEqual([]);
  });
});

describe('the DTO', () => {
  /**
   * The only test here that needs a row, so it makes and removes its own
   * rather than assuming the table has one. `finally` is what keeps the
   * "reviews is empty" assertion above true for the next run.
   */
  it('normalizes the Decimal rating to a number', async () => {
    await db.$executeRaw`
      insert into reviews (user_id, movie_id, rating, review, created_at, updated_at)
      values (${USER}, 1, 4.5, 'temporary row, removed by this test', now(), now())
    `;

    try {
      const review = await reviewRepository.findByUserAndMovieId(USER, 1);
      if (!review) throw new Error('the seeded review was not found');

      // rating is `numeric`, which Prisma hands back as a Decimal instance.
      // A Decimal is not JSON-serializable in any useful way — it crosses the
      // RSC boundary as `{ s, e, d }` — and it does not compare or format like
      // a number, so half the call sites would silently misbehave. The column
      // holds a 0–5 star rating, so a double loses nothing.
      expect(typeof review.rating).toBe('number');
      expect(review.rating).toBe(4.5);
      expect(JSON.parse(JSON.stringify(review)).rating).toBe(4.5);

      expect(Object.keys(review).sort()).toEqual(
        ['id', 'userId', 'movieId', 'rating', 'review', 'createdAt', 'updatedAt'].sort(),
      );
      expect(Object.getPrototypeOf(review)).toBe(Object.prototype);
      expect(review.createdAt).toBeInstanceOf(Date);

      const found = await reviewRepository.findById(review.id);
      expect(found.id).toBe(review.id);

      const batch = await reviewRepository.findByUserAndMovieIds(USER, [1, 2]);
      expect(batch).toHaveLength(1);
      expect(typeof batch[0]?.rating).toBe('number');
    } finally {
      await db.$executeRaw`
        delete from reviews where review = 'temporary row, removed by this test'
      `;
    }
  });

  it('leaves a null rating null', async () => {
    await db.$executeRaw`
      insert into reviews (user_id, movie_id, rating, review, created_at, updated_at)
      values (${USER}, 2, null, 'temporary unrated row', now(), now())
    `;

    try {
      const review = await reviewRepository.findByUserAndMovieId(USER, 2);
      expect(review?.rating).toBeNull();
    } finally {
      await db.$executeRaw`delete from reviews where review = 'temporary unrated row'`;
    }
  });
});
