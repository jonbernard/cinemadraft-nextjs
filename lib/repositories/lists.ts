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
};
