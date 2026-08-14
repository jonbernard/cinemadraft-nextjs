import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * A movie, shaped as the source API returned it.
 *
 * Declared explicitly rather than derived from the Prisma model so the
 * repository boundary is real: adding a column to the database does not
 * silently widen what every component receives, and Prisma types never leak
 * past this layer.
 */
export type Movie = {
  id: number;
  title: string | null;
  sortTitle: string | null;
  fbId: string | null;
  imdbId: string | null;
  tmdbId: string | null;
  /**
   * Bare TMDB paths, e.g. `/4Iu5f2nv7huqvuYkmZvSPOtbFjs.jpg` — NOT full URLs.
   *
   * The source API returned absolute URLs, built per request by prepending a
   * base fetched from TMDB's /configuration endpoint (see
   * `server/config/movieImages.js`). That base and the chosen size can change
   * without our data changing, so it is a presentation concern and lives in
   * `lib/external/tmdb.ts`, not here. Repositories return database truth.
   */
  poster: string | null;
  backdrop: string | null;
  releaseDate: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  /** Poster-derived accent, populated lazily. Not present in the source API. */
  accentHex: string | null;
};

const SELECT = {
  id: true,
  title: true,
  sortTitle: true,
  fbId: true,
  imdbId: true,
  tmdbId: true,
  poster: true,
  backdrop: true,
  releaseDate: true,
  createdAt: true,
  updatedAt: true,
  accentHex: true,
} as const;

export const movieRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Movie> {
    const movie = await db.movie.findUnique({ where: { id }, select: SELECT });
    if (!movie) throw new NotFoundError('movie', id);
    return movie;
  },

  /** Returns null on a miss: asking whether a TMDB movie is known locally is a legitimate question. */
  async findByTmdbId(tmdbId: string): Promise<Movie | null> {
    return db.movie.findFirst({ where: { tmdbId }, select: SELECT });
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * Accepts bigint because this schema has no foreign keys and the referencing
   * columns disagree on width: movies.id is integer, but draft_picks.movie_id,
   * nominations.movie_id, watchlists.movie_id and winners.movie_id are all
   * bigint. A dangling reference is therefore possible, and must not take down
   * a page render.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<Movie[]> {
    if (ids.length === 0) return [];
    return db.movie.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
  },

  /** Local-first title search, ordered for display (D20). */
  async search(query: string, limit = 20): Promise<Movie[]> {
    return db.movie.findMany({
      where: { title: { contains: query, mode: 'insensitive' } },
      select: SELECT,
      orderBy: { sortTitle: 'asc' },
      take: limit,
    });
  },
};
