import type { AwardModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * An award category — "Best Picture" at the Oscars — as the source API
 * returned it.
 *
 * The field list is written out rather than inherited wholesale, so adding a
 * column to the database cannot silently widen what every component receives.
 * The field *types* come from the generated model, so they cannot drift away
 * from the schema. `import type` is load-bearing: it is erased at compile time,
 * which is what keeps the Prisma runtime on this side of the boundary.
 *
 * Two columns are restated. `eventId` is normalized off bigint (see below),
 * and `points` is renamed, because the name the API used is wrong about what
 * the column holds.
 */
export type Award = Omit<
  Pick<
    AwardModel,
    | 'id'
    | 'fbId'
    | 'name'
    | 'eventId'
    | 'active'
    | 'points'
    | 'requiresNomineeName'
    | 'createdAt'
    | 'updatedAt'
  >,
  'eventId' | 'points'
> & {
  /**
   * Normalized from bigint. `awards.event_id` is bigint while `events.id` is
   * integer, and a bigint that reached a caller would throw "Do not know how
   * to serialize a BigInt" on the first `JSON.stringify` — a Server Action
   * result, a cache write, a log line. Every id in this database is sequence
   * generated and nowhere near `Number.MAX_SAFE_INTEGER`, so the narrowing is
   * lossless.
   */
  eventId: number;

  /**
   * A foreign key into `points.id` — **not** a point value.
   *
   * The source app declared `Awards.hasMany(Points, { sourceKey: 'points',
   * foreignKey: 'id', as: 'pointsData' })` (`server/models/points.js`), so the
   * column stores which row of the twelve-row points table this award is worth.
   * Best Picture stores `9`; points row 9 is Oscars tier 1, worth 20.
   *
   * The API exposed it as `points`, and carrying that name across would be the
   * most dangerous field in the port: summing `award.points` would score Best
   * Picture 9 instead of 20 and quietly corrupt every total in the app.
   * Resolve it through `pointRepository.findManyByIds` before scoring anything.
   *
   * Nullable because the column is: an award with no tier assigned scores
   * nothing, which is the service layer's call to make.
   */
  pointsId: number | null;
};

const SELECT = {
  id: true,
  fbId: true,
  name: true,
  eventId: true,
  active: true,
  points: true,
  requiresNomineeName: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The row as Prisma hands it over, before the two columns above are fixed. */
type AwardRow = Pick<AwardModel, keyof typeof SELECT>;

function toAward(row: AwardRow): Award {
  const { eventId, points, ...rest } = row;
  return { ...rest, eventId: Number(eventId), pointsId: points };
}

export const awardRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Award> {
    const award = await db.award.findUnique({ where: { id }, select: SELECT });
    if (!award) throw new NotFoundError('award', id);
    return toAward(award);
  },

  /**
   * Every award for one event — the query the award-show pages start from.
   *
   * Accepts bigint because `awards.event_id` is one, and returns an empty
   * array for an event that has none. This schema has no foreign keys, so a
   * dangling `event_id` is possible and must not throw.
   */
  async findByEventId(eventId: number | bigint): Promise<Award[]> {
    const rows = await db.award.findMany({
      where: { eventId: BigInt(eventId) },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toAward);
  },

  /** Batch form of {@link findByEventId}, for rendering several events at once. */
  async findManyByEventIds(eventIds: readonly (number | bigint)[]): Promise<Award[]> {
    if (eventIds.length === 0) return [];
    const rows = await db.award.findMany({
      where: { eventId: { in: eventIds.map(BigInt) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toAward);
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * Accepts bigint for the same reason `movieRepository.findManyByIds` does:
   * `awards.id` is integer, but `nominations.award_id` and `winners.award_id`
   * are bigint with nothing enforcing that they point anywhere.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<Award[]> {
    if (ids.length === 0) return [];
    const rows = await db.award.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return rows.map(toAward);
  },

  /** All 100 awards. Small enough to read whole; the admin screens do. */
  async findAll(): Promise<Award[]> {
    const rows = await db.award.findMany({ select: SELECT, orderBy: { id: 'asc' } });
    return rows.map(toAward);
  },

  /**
   * Add a category to a show (T27).
   *
   * `pointsId` is written straight into the `points` column — the same
   * foreign key the read side resolves back through `pointRepository`. The
   * caller is trusted to have already picked a real tier id; validating that
   * a tier exists is the action's job, the same split every other write in
   * this app makes between "the shape is right" (action) and "the row lands"
   * (repository).
   */
  async create(input: {
    name: string;
    eventId: number;
    pointsId: number | null;
    active: boolean;
    requiresNomineeName: boolean;
  }): Promise<Award> {
    const now = new Date();
    const row = await db.award.create({
      data: {
        name: input.name,
        eventId: BigInt(input.eventId),
        points: input.pointsId,
        active: input.active,
        requiresNomineeName: input.requiresNomineeName,
        createdAt: now,
        updatedAt: now,
      },
      select: SELECT,
    });
    return toAward(row);
  },

  /**
   * Remove a category.
   *
   * Unconditional — the caller (`actions/awards/delete-category.ts`) is where
   * the orphan check lives, because refusing belongs beside the reason it
   * refuses, not buried in a repository nobody reads before trusting it.
   * Throws NotFoundError rather than returning silently, like every other
   * delete in this layer.
   */
  async deleteById(id: number): Promise<void> {
    const deleted = await db.award.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new NotFoundError('award', id);
  },
};
