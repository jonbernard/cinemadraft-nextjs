import type { PointModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * One entry in the scoring table: what a `level` (an award show's weight class)
 * is worth at a given `tier`.
 *
 * Twelve rows, and every point total in the app is a multiple of one of them.
 * Awards reference these rows through `Award.pointsId` — the column the API
 * called `points`, which holds a `points.id` rather than a point value.
 *
 * The field list is written out so a new column cannot silently widen the DTO;
 * the field types come from the generated model so they cannot drift from the
 * schema. `import type` is erased at compile time, so no Prisma runtime
 * crosses this boundary.
 *
 * No bigint hygiene is needed here: every column is `integer`. `points` is
 * signed and genuinely goes negative — the Razzies tiers are worth -20, -15
 * and -10, the only penalty in the scoring system.
 */
export type Point = Pick<
  PointModel,
  'id' | 'level' | 'tier' | 'points' | 'createdAt' | 'updatedAt'
>;

const SELECT = {
  id: true,
  level: true,
  tier: true,
  points: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const pointRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Point> {
    const point = await db.point.findUnique({ where: { id }, select: SELECT });
    if (!point) throw new NotFoundError('point', id);
    return point;
  },

  /**
   * The whole table, ordered as a lookup table rather than as a page.
   *
   * `GET /points` returned `{ [level]: { [tier]: Point[] } }` — grouped twice,
   * with levels ordered by descending point value and tiers ascending. Both
   * are decisions about how the settings screen renders, so they belong to
   * whatever renders it.
   */
  async findAll(): Promise<Point[]> {
    return db.point.findMany({
      select: SELECT,
      orderBy: [{ level: 'asc' }, { tier: 'asc' }],
    });
  },

  /** Returns null on a miss: asking whether a tier is configured is legitimate. */
  async findByLevelAndTier(level: string, tier: number): Promise<Point | null> {
    return db.point.findFirst({ where: { level, tier }, select: SELECT });
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * This is the join that turns awards into scores: a scoring service collects
   * `Award.pointsId` across a set of nominations and resolves them all in one
   * query. Nothing enforces that reference, so an award pointing at a deleted
   * tier is skipped rather than throwing — it scores nothing, and that is the
   * service layer's decision to make.
   *
   * Accepts bigint like every other batch-by-id method in this layer, so
   * callers assembling ids from several tables do not each have to narrow them.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<Point[]> {
    if (ids.length === 0) return [];
    return db.point.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
  },
};
