import type { WinnerModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * A win — the nomination that took the award in a given year.
 *
 * The second half of the scoring input. A nomination scores its award's tier
 * once; a win scores the same tier a second time
 * (`server/routes/points.js`: `points + (movieId === winner.movieId ? points : 0)`).
 *
 * The field list is written out so a new column cannot silently widen the DTO;
 * the field types come from the generated model so they cannot drift from the
 * schema. `import type` is erased at compile time, so no Prisma runtime
 * crosses this boundary.
 *
 * The API nested `movie` and `award` objects here. Neither is reproduced: this
 * schema declares no relations, so composing them is the service layer's job —
 * and the captured `movie` was joined on the wrong column anyway. The source
 * app declared `Winners.hasOne(Movies, { foreignKey: 'id' })` with no
 * `sourceKey` (`server/models/winners.js`), which joins `movies.id` to
 * `winners.id` — the winner's own primary key — instead of `winners.movie_id`.
 * It matched for 722 of the 734 captured rows only because the two sequences
 * run roughly in step, and returned `null` for the 12 winners whose id runs
 * past the end of the movies table. Any join built on this DTO goes through
 * `movieId`.
 */
export type Winner = Omit<
  Pick<
    WinnerModel,
    | 'id'
    | 'fbId'
    | 'movieId'
    | 'awardId'
    | 'nominationId'
    | 'year'
    | 'createdAt'
    | 'updatedAt'
  >,
  'movieId' | 'awardId' | 'nominationId'
> & {
  /**
   * Normalized from bigint. `movie_id`, `award_id` and `nomination_id` are all
   * bigint while `movies.id`, `awards.id` and `nominations.id` are integer, and
   * a bigint handed to a caller throws "Do not know how to serialize a BigInt"
   * on the first `JSON.stringify`. Every id here is sequence generated and far
   * below `Number.MAX_SAFE_INTEGER`, so the narrowing is lossless.
   */
  movieId: number;
  awardId: number;
  nominationId: number;
};

const SELECT = {
  id: true,
  fbId: true,
  movieId: true,
  awardId: true,
  nominationId: true,
  year: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The row as Prisma hands it over, before the bigint columns are narrowed. */
type WinnerRow = Pick<WinnerModel, keyof typeof SELECT>;

function toWinner(row: WinnerRow): Winner {
  const { movieId, awardId, nominationId, ...rest } = row;
  return {
    ...rest,
    movieId: Number(movieId),
    awardId: Number(awardId),
    nominationId: Number(nominationId),
  };
}

export const winnerRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Winner> {
    const winner = await db.winner.findUnique({ where: { id }, select: SELECT });
    if (!winner) throw new NotFoundError('winner', id);
    return toWinner(winner);
  },

  /**
   * Every win on record — 734 rows, which is what `GET /winners` returned.
   *
   * `winners.year` is `integer`, unlike `nominations.year`, which is `text`.
   * The two tables genuinely disagree and each DTO reports its own column
   * rather than inventing a shared type that matches neither.
   */
  async findAll(): Promise<Winner[]> {
    const rows = await db.winner.findMany({ select: SELECT, orderBy: { id: 'asc' } });
    return rows.map(toWinner);
  },

  /** Every win in a season. Empty for a year whose ceremonies have not happened. */
  async findByYear(year: number): Promise<Winner[]> {
    const rows = await db.winner.findMany({
      where: { year },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toWinner);
  },

  /**
   * The winner of one award in one year, or null.
   *
   * `(award_id, year)` is the natural key: the source app upserted on it and
   * deleted by it (`server/controllers/winners.js`), and no pair repeats in
   * the data. Returns null rather than throwing because "has this award been
   * announced yet?" is a question the scoring path asks constantly, and the
   * answer is legitimately no.
   */
  async findByAwardIdAndYear(
    awardId: number | bigint,
    year: number,
  ): Promise<Winner | null> {
    const winner = await db.winner.findFirst({
      where: { awardId: BigInt(awardId), year },
      select: SELECT,
    });
    return winner ? toWinner(winner) : null;
  },

  /** Batch form of {@link findByAwardIdAndYear}, for a whole event at once. */
  async findManyByAwardIds(
    awardIds: readonly (number | bigint)[],
    year?: number,
  ): Promise<Winner[]> {
    if (awardIds.length === 0) return [];
    const rows = await db.winner.findMany({
      where: {
        awardId: { in: awardIds.map(BigInt) },
        ...(year === undefined ? {} : { year }),
      },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toWinner);
  },

  /**
   * Every win by any of these movies, optionally for one year.
   *
   * The scoring path starts from a draft's picks, which are movie ids. Ids
   * that resolve to nothing are skipped rather than throwing — there are no
   * foreign keys here, so a dangling `movie_id` is possible.
   */
  async findManyByMovieIds(
    movieIds: readonly (number | bigint)[],
    year?: number,
  ): Promise<Winner[]> {
    if (movieIds.length === 0) return [];
    const rows = await db.winner.findMany({
      where: {
        movieId: { in: movieIds.map(BigInt) },
        ...(year === undefined ? {} : { year }),
      },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toWinner);
  },

  /** Batch-load by id, skipping ids that do not resolve. */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<Winner[]> {
    if (ids.length === 0) return [];
    const rows = await db.winner.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toWinner);
  },
};
