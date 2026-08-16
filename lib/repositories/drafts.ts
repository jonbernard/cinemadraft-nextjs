import type { DraftModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * A seat in a league's draft for one year.
 *
 * "Draft" is the source app's word for a participant's slot, not for the
 * drafting event: one row per person per league per year, holding up to nine
 * picks. `group` and `order` together are the seat — `group` is the round-robin
 * bucket the board renders as a column, `order` the position within it.
 *
 * The field list is written out so a new column cannot silently widen the DTO;
 * the field types come from the generated model so they cannot drift from the
 * schema.
 *
 * `dummy` / `dummyName` are a placeholder participant: a league owner can seat
 * someone who has no account, in which case `userId` is null and `dummyName`
 * carries free text. It is free text containing real names, so it is personal
 * data — it was scrubbed in the fixtures and must never be logged.
 */
export type Draft = Pick<
  DraftModel,
  | 'id'
  | 'userId'
  | 'leagueId'
  | 'year'
  | 'group'
  | 'order'
  | 'dummy'
  | 'dummyName'
  | 'createdAt'
  | 'updatedAt'
>;

const SELECT = {
  id: true,
  userId: true,
  leagueId: true,
  year: true,
  group: true,
  order: true,
  dummy: true,
  dummyName: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Seat order: the board is read left to right, top to bottom.
 *
 * `id` breaks ties so the ordering is total — two seats sharing a group and
 * order would otherwise come back in whatever order the heap happened to
 * yield, and the page would reshuffle between requests.
 */
const BY_SEAT = [{ group: 'asc' }, { order: 'asc' }, { id: 'asc' }] as const;

export const draftRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Draft> {
    const draft = await db.draft.findUnique({ where: { id }, select: SELECT });
    if (!draft) throw new NotFoundError('draft', id);
    return draft;
  },

  /**
   * Every seat in one league-year, in board order.
   *
   * This is the draft board. `lib/services/draft.ts` derives the pick sequence
   * from this ordering — a snake league reverses `order` on alternate rounds —
   * so the ORDER BY is load-bearing rather than cosmetic.
   */
  async findByLeagueIdAndYear(leagueId: number, year: number): Promise<Draft[]> {
    return db.draft.findMany({
      where: { leagueId, year },
      select: SELECT,
      orderBy: [...BY_SEAT],
    });
  },

  /**
   * Every seat in a league, across all years.
   *
   * Deliberately year-wide. `GET /league/:id/:year?` accepted a year and then
   * ignored it — the route calls `Drafts.getByLeagueId`, which filters on
   * `leagueId` alone (`server/controllers/draft.js`) — which is why the
   * fixture captured at `/league/1/2025` carries seats from 2017 to 2026. The
   * year-filtered question is `findByLeagueIdAndYear`; this one answers the
   * league's whole history, which is what the league page's year switcher and
   * its selection list were actually built from.
   */
  async findByLeagueId(leagueId: number): Promise<Draft[]> {
    return db.draft.findMany({
      where: { leagueId },
      select: SELECT,
      orderBy: [{ year: 'desc' }, ...BY_SEAT],
    });
  },

  /**
   * Seats across several leagues for one year, in a single query.
   *
   * The draft watchlist loads the viewer's leagues and then every seat in them
   * for a year; one query per league would be a round trip per membership.
   *
   * Accepts bigint like every other batch-by-id method here: this schema has
   * no foreign keys, so a league id carried in from another table may not
   * resolve, and that must return fewer rows rather than throw.
   */
  async findByLeagueIdsAndYear(
    leagueIds: readonly (number | bigint)[],
    year: number,
  ): Promise<Draft[]> {
    if (leagueIds.length === 0) return [];
    return db.draft.findMany({
      where: { leagueId: { in: leagueIds.map(Number) }, year },
      select: SELECT,
      orderBy: [{ leagueId: 'asc' }, ...BY_SEAT],
    });
  },

  /** Every seat one person holds, newest season first — their profile's draft history. */
  async findByUserId(userId: number): Promise<Draft[]> {
    return db.draft.findMany({
      where: { userId },
      select: SELECT,
      orderBy: [{ year: 'desc' }, { leagueId: 'asc' }, { id: 'asc' }],
    });
  },

  /**
   * The leagues a person belongs to, as ids.
   *
   * Membership is a seat: there is no members table, so "my leagues" is the
   * distinct set of `drafts.league_id` for that user. This returns ids rather
   * than leagues because the schema declares no foreign keys and therefore no
   * Prisma relations — nothing to join through. The service pairs it with
   * `leagueRepository.findManyByIds`, which keeps each repository on its own
   * table.
   */
  async findLeagueIdsByUserId(userId: number): Promise<number[]> {
    const rows = await db.draft.findMany({
      where: { userId, leagueId: { not: null } },
      select: { leagueId: true },
      distinct: ['leagueId'],
      orderBy: { leagueId: 'asc' },
    });
    return rows.flatMap((row) => (row.leagueId === null ? [] : [row.leagueId]));
  },

  /**
   * The members of a league, as user ids.
   *
   * Named for what it takes. The source route is `GET /draft/users/:id`, which
   * reads as a draft id and is not one: the handler calls
   * `Drafts.getUsersByLeagueId` (`server/routes/draft.js`). Handed an actual
   * draft id it returned `[]` instead of erroring, so the bug was silent —
   * recorded in `docs/PROGRESS.md`, and corrected here rather than carried
   * over.
   *
   * Dummy seats are dropped: a placeholder participant has a null `userId`,
   * and a null has no place in a list of member ids.
   */
  async findUserIdsByLeagueId(leagueId: number): Promise<number[]> {
    const rows = await db.draft.findMany({
      where: { leagueId, userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    });
    return rows.flatMap((row) => (row.userId === null ? [] : [row.userId]));
  },

  /**
   * The seasons a league has drafted, newest first — its year switcher.
   *
   * The source route derived this in JS from the selections it had already
   * loaded (`years` in the captured response). Asking the database directly
   * means the switcher does not depend on having fetched every seat first.
   */
  async findYearsByLeagueId(leagueId: number): Promise<number[]> {
    const rows = await db.draft.findMany({
      where: { leagueId, year: { not: null } },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });
    return rows.flatMap((row) => (row.year === null ? [] : [row.year]));
  },

  /**
   * Seat someone in a league for a season.
   *
   * This is what "joining" is: there is no members table, so membership is the
   * existence of a `drafts` row (see `findLeagueIdsByUserId`).
   *
   * `order` and `group` are left null. A seat's position is assigned when the
   * owner sets up groups before the draft, and inventing one here would put
   * every new member at position null-coerced-to-0 on the board.
   */
  async create(input: {
    leagueId: number;
    year: number;
    userId?: number | null;
    group?: number | null;
    order?: number | null;
    dummyName?: string | null;
  }): Promise<Draft> {
    const now = new Date();
    return db.draft.create({
      data: {
        leagueId: input.leagueId,
        year: input.year,
        userId: input.userId ?? null,
        group: input.group ?? null,
        order: input.order ?? null,
        dummy: input.dummyName != null,
        dummyName: input.dummyName ?? null,
        createdAt: now,
        updatedAt: now,
      },
      select: SELECT,
    });
  },

  /**
   * Does this person already hold a seat in this league?
   *
   * Asked before joining. Deliberately **not** year-scoped, matching the
   * source's guard (`server/routes/draft.js:28`): membership is of the league,
   * not of a season, so someone who played in 2017 is already a member and
   * joining again would give them a second seat rather than a new year's one.
   * Seats for later seasons are created by the owner staging the next draft.
   */
  async findByLeagueIdAndUserId(leagueId: number, userId: number): Promise<Draft | null> {
    return db.draft.findFirst({
      where: { leagueId, userId },
      select: SELECT,
      orderBy: { year: 'desc' },
    });
  },
};
