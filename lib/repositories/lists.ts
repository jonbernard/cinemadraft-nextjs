import type { ListStatus } from '@/generated/prisma/enums';
import type { ListModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * A user's ranked shortlist of movies for one award season.
 *
 * The field list is written out so a new column cannot silently widen what
 * every component receives; the field *types* come from the generated model so
 * they cannot drift from the schema. Nothing below leaks a Prisma value —
 * `import type` is erased at compile time.
 */
export type List = Pick<
  ListModel,
  'id' | 'userId' | 'movieId' | 'order' | 'year' | 'status' | 'createdAt' | 'updatedAt'
>;

/**
 * Re-exported so callers can name the status without reaching into
 * `generated/`, which only this layer is allowed to import from.
 */
export type { ListStatus };

const SELECT = {
  id: true,
  userId: true,
  movieId: true,
  order: true,
  year: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<List> {
    const entry = await db.list.findUnique({ where: { id }, select: SELECT });
    if (!entry) throw new NotFoundError('list', id);
    return entry;
  },

  /**
   * One user's list for one season, in the order they arranged it.
   *
   * `order` is the user's own drag-and-drop position, maintained by the
   * reorder path, so it is the only sensible ordering — and it is what the
   * source API sorted by.
   *
   * An empty result is normal: a user has a list only for the years they
   * played. That is why `fixtures/lists-by-year.json` was captured at 2024
   * rather than the 2025 the rest of the fixtures use.
   *
   * The movie itself is not joined in. The source API nested the whole movie
   * inside every row; composing that is the caller's job, via
   * `movieRepository.findManyByIds`, so this layer stays one table wide.
   */
  async findByUserAndYear(userId: number, year: number): Promise<List[]> {
    return db.list.findMany({
      where: { userId, year },
      select: SELECT,
      orderBy: { order: 'asc' },
    });
  },

  /**
   * The caller's entry for one film in one season, if they already have one.
   *
   * A shortlist with the same film on it twice cannot be ranked, and no
   * constraint in the schema prevents it — there is no unique index on
   * (user_id, year, movie_id), so this read is the only thing standing between
   * a double-tap and two rows.
   */
  async findByUserYearAndMovie(
    userId: number,
    year: number,
    movieId: number,
  ): Promise<List | null> {
    return db.list.findFirst({ where: { userId, year, movieId }, select: SELECT });
  },

  /**
   * Append a film to someone's list.
   *
   * `order` is the caller's, as it is for a draft pick: "the end of the list"
   * is a question about the list, not about this row, and the service that
   * just read the list is the only place that knows the answer.
   *
   * `createdAt`/`updatedAt` are written explicitly because the columns are
   * nullable — the Sequelize app always filled them, and a null pair would
   * make a new row indistinguishable from a legacy one.
   */
  async create(input: {
    userId: number;
    movieId: number;
    year: number;
    order: number;
  }): Promise<List> {
    const now = new Date();
    return db.list.create({
      data: { ...input, status: 'none', createdAt: now, updatedAt: now },
      select: SELECT,
    });
  },

  /**
   * Mark an entry taken by the caller, taken by somebody else, or neither.
   *
   * `userId` is in the WHERE clause rather than checked beforehand, so another
   * member's entry is not addressable by id at all. `updateMany` rather than
   * `update` because (id, user_id) is not a unique key the query API can
   * target — a miss is therefore a count of zero rather than a throw, which is
   * what makes the NotFoundError ours to raise.
   */
  async setStatus(id: number, userId: number, status: ListStatus): Promise<void> {
    const updated = await db.list.updateMany({
      where: { id, userId },
      data: { status, updatedAt: new Date() },
    });
    if (updated.count === 0) throw new NotFoundError('list', id);
  },

  /** Removes one of the caller's entries. Someone else's id is a miss. */
  async deleteByIdForUser(id: number, userId: number): Promise<void> {
    const deleted = await db.list.deleteMany({ where: { id, userId } });
    if (deleted.count === 0) throw new NotFoundError('list', id);
  },

  /**
   * Rewrite one member's ordering for one season, atomically.
   *
   * 🔴 One transaction, not a loop of updates. The source route mapped over
   * the body and issued an update per row (`routes/lists.js:31`), so a failure
   * halfway left two entries sharing an `order` — and a list that cannot be
   * put in a total order is exactly the thing this page exists to produce.
   *
   * Takes an ordered list of ids rather than `{id, order}` pairs, so duplicate
   * or skipped positions are not representable; positions are assigned 1..N
   * from the list order. Legacy rows are 0-based, which is harmless: `order`
   * only ever expresses a sequence, and the first reorder renumbers the whole
   * list.
   *
   * `userId` and `year` are in every WHERE clause, so an id from another
   * member's list — or from the same member's other season — cannot be
   * renumbered even if it is passed.
   */
  async reorder(
    userId: number,
    year: number,
    entryIds: readonly number[],
  ): Promise<void> {
    if (entryIds.length === 0) return;
    const now = new Date();
    await db.$transaction(
      entryIds.map((id, index) =>
        db.list.updateMany({
          where: { id, userId, year },
          data: { order: index + 1, updatedAt: now },
        }),
      ),
    );
  },
};
