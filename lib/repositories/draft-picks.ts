import type { DraftPickModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

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
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<DraftPick> {
    const pick = await db.draftPick.findUnique({ where: { id }, select: SELECT });
    if (!pick) throw new NotFoundError('draft pick', id);
    return toDraftPick(pick);
  },

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

  /**
   * Add a pick to a seat.
   *
   * `order` is the caller's: the service reads the seat's current picks to
   * decide it, because "the next round" is a question about the seat, not
   * about this row. `createdAt`/`updatedAt` are nullable in the schema — the
   * Sequelize app always wrote them, and a null pair would make a new row
   * indistinguishable from the handful of legacy rows that lack them.
   */
  async create(input: {
    draftId: number;
    movieId: number;
    order: number;
    userId: number | null;
  }): Promise<DraftPick> {
    const now = new Date();
    const pick = await db.draftPick.create({
      data: {
        draftId: input.draftId,
        movieId: BigInt(input.movieId),
        order: input.order,
        userId: input.userId,
        createdAt: now,
        updatedAt: now,
      },
      select: SELECT,
    });
    return toDraftPick(pick);
  },

  /** Removes a pick. Throws NotFoundError if it is already gone. */
  async deleteById(id: number): Promise<void> {
    const deleted = await db.draftPick.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new NotFoundError('draft pick', id);
  },

  /**
   * Rewrite one seat's ordering, atomically.
   *
   * 🔴 One transaction, not a loop of updates. The source app wrote
   * `req.body.forEach(async (item) => DraftPicks.update(...))` — an async
   * callback inside `forEach`, so nothing awaited any of them and the response
   * was sent while the writes were still in flight. A half-applied reorder
   * leaves two picks sharing an `order`, and the board then renders two films
   * in the same round with no indication which is which.
   *
   * Takes the seat's picks as an *ordered list of ids* rather than
   * `{id, order}` pairs. The pairs are what the source route accepted, and
   * they let a client send duplicate or missing positions; a list cannot
   * express that state at all, so the invariant holds by construction rather
   * than by validation. Positions are assigned 1..N from the list order.
   *
   * `draftId` is required and every row is updated with it in the WHERE
   * clause, so a pick belonging to another seat cannot be renumbered even if
   * its id is passed — the caller's ownership check covers one league, and
   * this makes that scope structural.
   */
  async reorder(draftId: number, pickIds: readonly number[]): Promise<void> {
    if (pickIds.length === 0) return;
    const now = new Date();
    await db.$transaction(
      pickIds.map((id, index) =>
        db.draftPick.updateMany({
          where: { id, draftId },
          data: { order: index + 1, updatedAt: now },
        }),
      ),
    );
  },
};
