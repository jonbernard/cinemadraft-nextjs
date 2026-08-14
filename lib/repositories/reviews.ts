/**
 * 🔴 `reviews` has 0 rows in production.
 *
 * The table and its Sequelize model shipped, but the feature was never used:
 * `GET /reviews/tmdbId/313369` was captured as `{}`, which is the response
 * wrapper turning a null into an object, not a failed capture. Phase 7 decides
 * whether reviews ship at all, so this repository is deliberately minimal and
 * is **unproven against real data** — nothing here has ever run over a
 * production row, and the shapes below are inferred from the schema and the
 * source controller rather than confirmed by a fixture. Treat it accordingly
 * if the feature is revived.
 */

import type { ReviewModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * One user's review of one movie.
 *
 * The field list is explicit so a new column cannot silently widen the DTO;
 * the types come from the generated model, except `rating`, normalized below.
 */
export type Review = Omit<
  Pick<
    ReviewModel,
    'id' | 'userId' | 'movieId' | 'rating' | 'review' | 'createdAt' | 'updatedAt'
  >,
  'rating'
> & {
  /**
   * Normalized from Prisma's `Decimal`.
   *
   * The column is unconstrained `numeric`, so Prisma hands back a Decimal
   * instance rather than a number. That does not survive the RSC boundary in
   * any useful form — it serializes to its internal `{ s, e, d }` — and it
   * compares and formats unlike a number, so a call site doing `rating > 3` or
   * `rating.toFixed(1)` would be quietly wrong. The value is a star rating in
   * a 0–5 range with at most one decimal place, so a double represents it
   * exactly and loses nothing.
   *
   * Nullable because the column is: a written review need not carry a score.
   */
  rating: number | null;
};

const SELECT = {
  id: true,
  userId: true,
  movieId: true,
  rating: true,
  review: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Prisma's Decimal, narrowed to the one method this file needs. */
type Row = Omit<Review, 'rating'> & { rating: { toNumber(): number } | null };

function toDto(row: Row): Review {
  return { ...row, rating: row.rating === null ? null : row.rating.toNumber() };
}

export const reviewRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Review> {
    const review = await db.review.findUnique({ where: { id }, select: SELECT });
    if (!review) throw new NotFoundError('review', id);
    return toDto(review);
  },

  /**
   * Returns null on a miss: "has this user reviewed this movie yet" is a
   * legitimate question, and the answer is usually no.
   *
   * Scoped to the user, which the source route was not — `Reviews.getByTmdbId`
   * required a signed-in user and then filtered on movieId alone, so it could
   * hand back somebody else's review to be shown in this user's edit form.
   *
   * Takes a local movie id, not a TMDB id. The source route resolved the TMDB
   * id to a local movie first (creating it if absent, which is a write); that
   * resolution belongs above this layer, in the service that owns saving a
   * film.
   */
  async findByUserAndMovieId(
    userId: number,
    movieId: number | bigint,
  ): Promise<Review | null> {
    const review = await db.review.findFirst({
      where: { userId, movieId: Number(movieId) },
      select: SELECT,
    });
    return review === null ? null : toDto(review);
  },

  /**
   * The user's reviews for a batch of movies, skipping the ones they have not
   * reviewed.
   *
   * The watchlist page hangs a user's own review off each row, and holds
   * bigint movie ids to do it — `watchlists.movie_id` is bigint while
   * `reviews.movie_id` is integer, with no foreign key between them, so a
   * dangling id has to be a miss rather than an error.
   */
  async findByUserAndMovieIds(
    userId: number,
    movieIds: readonly (number | bigint)[],
  ): Promise<Review[]> {
    if (movieIds.length === 0) return [];
    const reviews = await db.review.findMany({
      where: { userId, movieId: { in: movieIds.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return reviews.map(toDto);
  },
};
