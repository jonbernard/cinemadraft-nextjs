import type { NominationModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * A nomination — one movie put forward for one award in one year.
 *
 * 4559 rows, and the input every point total in the app is computed from: a
 * nomination scores its award's tier once, and a win scores it again.
 *
 * The field list is written out so a new column cannot silently widen the DTO;
 * the field types come from the generated model so they cannot drift from the
 * schema. `import type` is erased at compile time, so no Prisma runtime
 * crosses this boundary.
 *
 * The API nested a `movie` object here. This schema declares no relations, so
 * composing that is the service layer's job — the repository returns rows from
 * one table and stops.
 */
export type Nomination = Omit<
  Pick<
    NominationModel,
    | 'id'
    | 'fbId'
    | 'movieId'
    | 'awardId'
    | 'year'
    | 'detailName'
    | 'detailCharacter'
    | 'detailId'
    | 'createdAt'
    | 'updatedAt'
  >,
  'movieId' | 'awardId' | 'detailId'
> & {
  /**
   * Normalized from bigint. `nominations.movie_id` and `award_id` are bigint
   * while `movies.id` and `awards.id` are integer, and a bigint handed to a
   * caller throws "Do not know how to serialize a BigInt" on the first
   * `JSON.stringify`. These rows are the scoring input, so they are serialized
   * constantly. Every id here is sequence generated and far below
   * `Number.MAX_SAFE_INTEGER`, so the narrowing is lossless.
   */
  movieId: number;
  awardId: number;
  /** Normalized from bigint, same reasoning. Nullable because the column is. */
  detailId: number | null;
};

/** One movie's nomination count for a year, as `/watchlist/noms/:year` needed. */
export type NominationCount = {
  movieId: number;
  count: number;
};

const SELECT = {
  id: true,
  fbId: true,
  movieId: true,
  awardId: true,
  year: true,
  detailName: true,
  detailCharacter: true,
  detailId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The row as Prisma hands it over, before the bigint columns are narrowed. */
type NominationRow = Pick<NominationModel, keyof typeof SELECT>;

function toNomination(row: NominationRow): Nomination {
  const { movieId, awardId, detailId, ...rest } = row;
  return {
    ...rest,
    movieId: Number(movieId),
    awardId: Number(awardId),
    detailId: detailId === null ? null : Number(detailId),
  };
}

export const nominationRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Nomination> {
    const nomination = await db.nomination.findUnique({ where: { id }, select: SELECT });
    if (!nomination) throw new NotFoundError('nomination', id);
    return toNomination(nomination);
  },

  /**
   * Every nomination for a season.
   *
   * `year` is a string because `nominations.year` is `text` — the only year
   * column in the schema that is not `integer`. Coercing it here would make
   * the DTO disagree with the value callers have to pass back in, so the
   * oddity stays visible rather than being papered over halfway down the stack.
   */
  async findByYear(year: string): Promise<Nomination[]> {
    const rows = await db.nomination.findMany({
      where: { year },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toNomination);
  },

  /**
   * Every nomination earned by any of these movies, optionally for one year.
   *
   * The shape the scoring path needs: it starts from a draft's picks, which
   * are movie ids. Ids that resolve to nothing are skipped rather than
   * throwing — there are no foreign keys here, so a dangling `movie_id` is
   * possible and must not take down a page render.
   */
  async findManyByMovieIds(
    movieIds: readonly (number | bigint)[],
    year?: string,
  ): Promise<Nomination[]> {
    if (movieIds.length === 0) return [];
    const rows = await db.nomination.findMany({
      where: { movieId: { in: movieIds.map(BigInt) }, ...(year ? { year } : {}) },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toNomination);
  },

  /**
   * Every nomination for these awards, optionally for one year.
   *
   * Award ids come from `awardRepository.findByEventId`, which is how "the
   * nominations at this event, this year" is assembled without a join.
   */
  async findManyByAwardIds(
    awardIds: readonly (number | bigint)[],
    year?: string,
  ): Promise<Nomination[]> {
    if (awardIds.length === 0) return [];
    const rows = await db.nomination.findMany({
      where: { awardId: { in: awardIds.map(BigInt) }, ...(year ? { year } : {}) },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toNomination);
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * Accepts bigint because `winners.nomination_id` is bigint against an
   * integer `nominations.id`, with nothing enforcing that it points anywhere.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<Nomination[]> {
    if (ids.length === 0) return [];
    const rows = await db.nomination.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toNomination);
  },

  /**
   * How many nominations each movie earned in a year.
   *
   * Counting is not scoring — no point value is involved — so it belongs here
   * rather than in the service layer. The source app read every row for the
   * year and counted them in JavaScript; with 4559 rows in the table that is
   * the wrong side of the wire to count on.
   */
  async countByYear(year: string): Promise<NominationCount[]> {
    const rows = await db.nomination.groupBy({
      by: ['movieId'],
      where: { year },
      _count: { _all: true },
      orderBy: [{ _count: { movieId: 'desc' } }, { movieId: 'asc' }],
    });
    return rows.map((row) => ({
      movieId: Number(row.movieId),
      count: row._count._all,
    }));
  },
};
