import type { DraftPickModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';

/**
 * One movie taken in one seat's draft.
 *
 * `order` is the round it was taken in, and it is the reason this table
 * exists: it drives the draft board, and the movie page averages it into
 * `avgDraftPos`. Nothing in the database constrains how many picks a seat may
 * hold — `order` runs 1..9 across all 1025 rows, though the domain was
 * documented as eight — so the cap is a per-season app rule that belongs in
 * `lib/services/draft.ts`, and this layer never truncates.
 *
 * The field list is written out so a new column cannot silently widen the DTO;
 * the field types come from the generated model so they cannot drift from the
 * schema. `movieId` is the one exception, restated below.
 */
export type DraftPick = Omit<
  Pick<
    DraftPickModel,
    'id' | 'draftId' | 'movieId' | 'order' | 'userId' | 'createdAt' | 'updatedAt'
  >,
  'movieId'
> & {
  /**
   * Normalized from bigint to number at this boundary.
   *
   * `draft_picks.movie_id` is bigint and Prisma hands back a JS bigint, which
   * makes `JSON.stringify` throw. In a Server Component that means the page
   * fails to *serialize* rather than to render, which is a much harder error
   * to read. The narrowing is safe because movie ids are in the low thousands;
   * `movies.id` is a plain integer, so nothing a pick can legitimately point
   * at comes close to `Number.MAX_SAFE_INTEGER`.
   */
  movieId: number;
};

const SELECT = {
  id: true,
  draftId: true,
  movieId: true,
  order: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Pick order within a seat; `id` breaks ties so the ordering is total. */
const BY_ORDER = [{ order: 'asc' }, { id: 'asc' }] as const;

/** The row as stored, before `movieId` is narrowed. */
type DraftPickRow = Omit<DraftPick, 'movieId'> & { movieId: bigint };

function toDraftPick({ movieId, ...rest }: DraftPickRow): DraftPick {
  return { ...rest, movieId: Number(movieId) };
}

export const draftPickRepository = {
  /** One seat's picks, in the order they were taken. */
  async findByDraftId(draftId: number): Promise<DraftPick[]> {
    const picks = await db.draftPick.findMany({
      where: { draftId },
      select: SELECT,
      orderBy: [...BY_ORDER],
    });
    return picks.map(toDraftPick);
  },

  /**
   * Picks for several seats at once, grouped by seat and ordered within it.
   *
   * The league board renders every seat in a league-year together; one query
   * per seat would be a dozen round trips for a single page.
   *
   * Accepts bigint like every other batch-by-id method here — this schema
   * declares no foreign keys, so an id carried in from another table may not
   * resolve, and that must return fewer rows rather than throw.
   */
  async findManyByDraftIds(draftIds: readonly (number | bigint)[]): Promise<DraftPick[]> {
    if (draftIds.length === 0) return [];
    const picks = await db.draftPick.findMany({
      where: { draftId: { in: draftIds.map(Number) } },
      select: SELECT,
      orderBy: [{ draftId: 'asc' }, ...BY_ORDER],
    });
    return picks.map(toDraftPick);
  },

  /**
   * Every time a movie was drafted, anywhere.
   *
   * Feeds `avgDraftPos` on the movie page. Takes bigint as well as number
   * because the two sides disagree on width: `movies.id` is integer while
   * `draft_picks.movie_id` is bigint, so a caller may hold the id from either
   * side. An id too large for a movie to have is a question with an empty
   * answer, not an error.
   */
  async findByMovieId(movieId: number | bigint): Promise<DraftPick[]> {
    const picks = await db.draftPick.findMany({
      where: { movieId: BigInt(movieId) },
      select: SELECT,
      orderBy: [{ draftId: 'asc' }, ...BY_ORDER],
    });
    return picks.map(toDraftPick);
  },
};
