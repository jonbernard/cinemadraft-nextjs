import { movieRepository } from '@/lib/repositories/movies';
import { reviewRepository } from '@/lib/repositories/reviews';
import { ensureFilm } from '@/lib/services/film-ingest';

/**
 * A member's own review of one film, keyed by TMDB id (P10.T38, T39).
 *
 * 🔴 **Only ever your own.** The source's `GET /reviews/tmdbId/:tmdbId` checked
 * that *somebody* was signed in and then filtered on `movieId` alone, so it
 * handed back whichever review Sequelize found first — someone else's, loaded
 * into your edit form and overwritten on save. Every function here takes the
 * reader's own id and passes it to a repository method that scopes on it.
 */

export type MyReview = {
  /** 0.5–5 at half-star precision, or null for words without a score. */
  rating: number | null;
  review: string | null;
  updatedAt: Date | null;
};

/** What a member may store: a rating, some words, or both — never neither. */
export type ReviewDraft = { rating: number | null; review: string | null };

function toMyReview(row: {
  rating: number | null;
  review: string | null;
  updatedAt: Date | null;
}): MyReview {
  return { rating: row.rating, review: row.review, updatedAt: row.updatedAt };
}

/**
 * Null both when there is no review and when there is nobody to have written
 * one.
 *
 * Costs no queries at all for a film nobody has used, on the same reasoning as
 * `isFilmWatched`: `reviews.movie_id` points at a local `movies` row, so with no
 * local row there is nothing that could point at it.
 */
export async function loadMyReview(
  tmdbId: string,
  userId: number | null,
): Promise<MyReview | null> {
  if (userId == null) return null;

  const movie = await movieRepository.findByTmdbId(tmdbId);
  if (!movie) return null;

  const review = await reviewRepository.findByUserAndMovieId(userId, movie.id);
  return review === null ? null : toMyReview(review);
}

/**
 * One review per member per film, edited in place (R13).
 *
 * Ingests the film first, as the source's `saveReview` did via `saveFilm` — a
 * member deliberately writing about a film is exactly the act that earns a row
 * in `movies` (D63), and the row has to exist before a review can point at it.
 */
export async function saveMyReview(
  userId: number,
  tmdbId: string,
  draft: ReviewDraft,
): Promise<MyReview> {
  const movie = await ensureFilm(tmdbId);
  const saved = await reviewRepository.saveForUserAndMovie(userId, movie.id, draft);
  return toMyReview(saved);
}

/** A no-op when there is nothing to remove; two tabs may disagree for a moment. */
export async function deleteMyReview(userId: number, tmdbId: string): Promise<void> {
  const movie = await movieRepository.findByTmdbId(tmdbId);
  if (!movie) return;

  await reviewRepository.deleteByUserAndMovie(userId, movie.id);
}
