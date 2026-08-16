import { randomUUID } from 'node:crypto';

import type { LeagueDraftingStatus, LeagueType } from '@/generated/prisma/enums';
import type { LeagueModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * Re-exported so callers get the enums without reaching into `generated/`.
 *
 * `LeagueType` is the draft algorithm — `linear` deals every round in the same
 * seat order, `snake` reverses on alternate rounds. `LeagueDraftingStatus`
 * gates the draft board: `pending` before it opens, `active` while picks are
 * being made, `complete` once it is locked.
 */
export type { LeagueDraftingStatus, LeagueType };

/**
 * A league.
 *
 * The field list is written out rather than taking the whole model, so adding
 * a column to the database cannot silently widen what every component
 * receives. The field *types* come from the generated model, so they cannot
 * drift from the schema.
 *
 * `owner` is omitted and restated as `ownerIds` — see below.
 */
export type League = Omit<
  Pick<
    LeagueModel,
    | 'id'
    | 'fbId'
    | 'activeYear'
    | 'draftingStatus'
    | 'type'
    | 'name'
    | 'owner'
    | 'uuid'
    | 'createdAt'
    | 'updatedAt'
  >,
  'owner'
> & {
  /**
   * The league's owners, parsed from `leagues.owner`.
   *
   * That column is TEXT holding a JSON array — the literal string `[3]`. The
   * source app hid it behind a Sequelize getter (`server/models/leagues.js`),
   * so nothing in the app ever saw the raw string. Parsing here keeps that
   * true without a getter, and it is not cosmetic: every ownership check in
   * the source app was `league.owner.includes(user.id)`, and run against the
   * unparsed string that becomes a substring match. `"[13]".includes(3)` is
   * false, but `"[31]".includes(3)` is true — an authorization check that
   * passes for the wrong user.
   *
   * Fails closed: unparseable text yields an empty list, which denies
   * ownership rather than throwing and taking out every league listing.
   */
  ownerIds: number[];
};

/** The row as stored, before `owner` is parsed. */
type LeagueRow = Omit<League, 'ownerIds'> & { owner: string };

const SELECT = {
  id: true,
  fbId: true,
  activeYear: true,
  draftingStatus: true,
  type: true,
  name: true,
  owner: true,
  uuid: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Postgres rejects a malformed uuid literal at the type level. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toLeague({ owner, ...rest }: LeagueRow): League {
  return { ...rest, ownerIds: parseOwner(owner) };
}

function parseOwner(owner: string): number[] {
  try {
    const parsed: unknown = JSON.parse(owner);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => Number.isSafeInteger(id));
  } catch {
    return [];
  }
}

export const leagueRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<League> {
    const league = await db.league.findUnique({ where: { id }, select: SELECT });
    if (!league) throw new NotFoundError('league', id);
    return toLeague(league);
  },

  /**
   * Returns null on a miss: the uuid is the invite link, and a stale or
   * mistyped one is a user mistake rather than a programming error.
   *
   * The shape is checked before the query because Postgres rejects a
   * malformed uuid literal at the type level, and that arrives as a raw driver
   * error carrying the SQL — which is exactly what a repository must not let
   * escape (see `lib/errors.ts`).
   */
  async findByUuid(uuid: string): Promise<League | null> {
    if (!UUID.test(uuid)) return null;
    const league = await db.league.findFirst({ where: { uuid }, select: SELECT });
    return league ? toLeague(league) : null;
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * Accepts bigint for the same reason `movieRepository.findManyByIds` does:
   * this schema has no foreign keys, so `drafts.league_id` can point at a
   * league that no longer exists, and a dangling reference must not take down
   * a page render.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<League[]> {
    if (ids.length === 0) return [];
    const leagues = await db.league.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return leagues.map(toLeague);
  },

  /**
   * Start a league.
   *
   * 🔴 **`owner` is TEXT holding a JSON array**, so a write has to produce the
   * exact shape `ownerIds` parses back (D47). `JSON.stringify` of an array of
   * numbers is that shape; anything else — a bare id, a comma-joined string —
   * parses to an empty list and locks the creator out of their own league. The
   * round trip is asserted in the tests rather than assumed.
   *
   * `uuid` is generated here because the column has no database default. The
   * source app got one from Sequelize's `defaultValue: UUIDV4`
   * (`server/models/leagues.js:17-20`), which is ORM behaviour the schema
   * never carried — so a league created without this line would have a null
   * invite link and no way to add anyone.
   *
   * `draftingStatus` starts at `pending`, matching the source: a new league is
   * assigning order and groups, not drafting.
   */
  async create(input: {
    name: string;
    ownerId: number;
    type: LeagueType;
  }): Promise<League> {
    const now = new Date();
    const row = await db.league.create({
      data: {
        name: input.name,
        owner: JSON.stringify([input.ownerId]),
        uuid: randomUUID(),
        type: input.type,
        draftingStatus: 'pending',
        createdAt: now,
        updatedAt: now,
      },
      select: SELECT,
    });
    return toLeague(row);
  },

  /**
   * Change a league's settings.
   *
   * Deliberately narrow: name, draft type, drafting status and active year,
   * and nothing else. 🔴 The source's `PUT /league/:id` wrote `req.body`
   * straight through (`PARITY.md` bug 6), so a request could set `owner` and
   * take the league — the same column every ownership check reads.
   */
  async update(
    id: number,
    changes: {
      name?: string;
      type?: LeagueType;
      draftingStatus?: LeagueDraftingStatus;
      activeYear?: number;
    },
  ): Promise<League> {
    const row = await db.league.update({
      where: { id },
      data: {
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.type !== undefined ? { type: changes.type } : {}),
        ...(changes.draftingStatus !== undefined
          ? { draftingStatus: changes.draftingStatus }
          : {}),
        ...(changes.activeYear !== undefined ? { activeYear: changes.activeYear } : {}),
        updatedAt: new Date(),
      },
      select: SELECT,
    });
    return toLeague(row);
  },
};
