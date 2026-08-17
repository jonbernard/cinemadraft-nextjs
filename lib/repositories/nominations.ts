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
   * `year` is a number. It was TEXT — the only year column in the schema that
   * was — until `20260816120000_nominations_year_integer`. That inconsistency
   * silently produced empty results wherever a comparison forgot to convert,
   * which is a failure that looks like "this film scored nothing" rather than
   * like an error.
   */
  async findByYear(year: number): Promise<Nomination[]> {
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
    year?: number,
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
   * The seasons one film was nominated in, most recent first.
   *
   * The film page needs this because `ledgerForMovies` takes a year and the page
   * has no season of its own — it is reached from a poster, not from a
   * leaderboard. 🔴 The source read the year off whichever nomination row came
   * back first (`server/routes/points.js:87` — `data[0].year`), which is an
   * arbitrary choice dressed as a fact: a film nominated in two seasons scored
   * for whichever the database happened to return, and the page gave a different
   * total on different days. Returning the list makes the caller say which one
   * it means.
   *
   * Rows with no year are excluded rather than sorted to the end: a nomination
   * that cannot be attributed to a season cannot be scored either, which is the
   * same rule `loadScoringInputs` applies.
   */
  async findYearsByMovieId(movieId: number | bigint): Promise<number[]> {
    const rows = await db.nomination.findMany({
      where: { movieId: BigInt(movieId), year: { not: null } },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });
    return rows.flatMap((row) => (row.year == null ? [] : [row.year]));
  },

  /**
   * Every nomination for these awards, optionally for one year.
   *
   * Award ids come from `awardRepository.findByEventId`, which is how "the
   * nominations at this event, this year" is assembled without a join.
   */
  async findManyByAwardIds(
    awardIds: readonly (number | bigint)[],
    year?: number,
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
  async countByYear(year: number): Promise<NominationCount[]> {
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

  /**
   * Record that a film is nominated for an award in a year.
   *
   * `year` is a number, like every other year column. It was TEXT until the
   * `20260816120000_nominations_year_integer` migration — see that file for
   * why the inconsistency had to go rather than be worked around.
   */
  async create(input: {
    movieId: number;
    awardId: number;
    year: number;
    detailName?: string | null;
    detailCharacter?: string | null;
    detailId?: number | null;
  }): Promise<Nomination> {
    const now = new Date();
    const row = await db.nomination.create({
      data: {
        movieId: BigInt(input.movieId),
        awardId: BigInt(input.awardId),
        year: input.year,
        detailName: input.detailName ?? null,
        detailCharacter: input.detailCharacter ?? null,
        detailId: input.detailId == null ? null : BigInt(input.detailId),
        createdAt: now,
        updatedAt: now,
      },
      select: SELECT,
    });
    return toNomination(row);
  },

  /** Removes a nomination. Throws NotFoundError if it is already gone. */
  async deleteById(id: number): Promise<void> {
    const deleted = await db.nomination.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new NotFoundError('nomination', id);
  },

  /**
   * Is this film already nominated in this category this year?
   *
   * Its own method rather than a filter over `findManyByAwardIds`, because the
   * caller is asking a yes/no question before a write and should not have to
   * load a category's whole slate to answer it.
   */
  async findByAwardMovieYear(
    awardId: number,
    movieId: number,
    year: number,
  ): Promise<Nomination | null> {
    const row = await db.nomination.findFirst({
      where: { awardId: BigInt(awardId), movieId: BigInt(movieId), year },
      select: SELECT,
    });
    return row ? toNomination(row) : null;
  },
};
