import type { EventModel } from '@/generated/prisma/models';
import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';

/**
 * An award show, shaped as the source API returned it.
 *
 * The field list is written out rather than taken wholesale from the Prisma
 * model so the repository boundary is real: adding a column to the database
 * does not silently widen what every component receives. The field *types*
 * come from the generated model, so they cannot drift from the schema.
 *
 * Note what is absent. The source controller eager-loaded `awards` — with
 * their points, their nominations for the requested year, and each nominated
 * movie — on every event read, and `GET /events` then dropped the whole graph
 * again before responding. Composing that is a service concern; this layer
 * returns one row.
 */
export type Event = Omit<
  Pick<
    EventModel,
    | 'id'
    | 'fbId'
    | 'name'
    | 'abbreviation'
    | 'image'
    | 'liveResults'
    | 'nomActive'
    | 'nomDate'
    | 'nomTime'
    | 'nomDuration'
    | 'awardsActive'
    | 'awardsDate'
    | 'awardsTime'
    | 'awardsDuration'
    | 'createdAt'
    | 'updatedAt'
  >,
  'nomDate' | 'nomTime' | 'nomDuration' | 'awardsDate' | 'awardsTime' | 'awardsDuration'
> & {
  /**
   * Epoch milliseconds, UTC midnight of the announcement day.
   *
   * Normalized from bigint: a bigint anywhere in a DTO throws on
   * `JSON.stringify`, which would take down every Server Component that hands
   * an event to a Client Component. These are millisecond timestamps and
   * day offsets, far inside `Number.MAX_SAFE_INTEGER`, and the source API
   * served them as JSON numbers — number is the captured contract.
   */
  nomDate: number | null;
  /** Milliseconds past midnight, added to `nomDate` to get the local start. */
  nomTime: number | null;
  /** Milliseconds. Null means unknown, and the calendar falls back to 30 minutes. */
  nomDuration: number | null;
  awardsDate: number | null;
  awardsTime: number | null;
  awardsDuration: number | null;
};

const SELECT = {
  id: true,
  fbId: true,
  name: true,
  abbreviation: true,
  image: true,
  liveResults: true,
  nomActive: true,
  nomDate: true,
  nomTime: true,
  nomDuration: true,
  awardsActive: true,
  awardsDate: true,
  awardsTime: true,
  awardsDuration: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The row as Prisma hands it back — the six schedule columns still bigint. */
type Row = Pick<EventModel, keyof Event>;

/**
 * `Number(null)` is `0`, and zero is a meaningful duration here — the calendar
 * only falls back to a default block when the value is genuinely absent. So
 * the null check cannot be skipped.
 */
function ms(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

function toEvent(row: Row): Event {
  return {
    ...row,
    nomDate: ms(row.nomDate),
    nomTime: ms(row.nomTime),
    nomDuration: ms(row.nomDuration),
    awardsDate: ms(row.awardsDate),
    awardsTime: ms(row.awardsTime),
    awardsDuration: ms(row.awardsDuration),
  };
}

/**
 * The columns a caller may change — deliberately narrower than `Event`.
 *
 * `id`, `fbId`, `createdAt`, `updatedAt` are absent on purpose: the source
 * controller was `Events.update(req.body, …)`, unfiltered mass assignment,
 * and whatever the client posted was written verbatim (D-brief T26). This
 * type is the whitelist; the action layer is what enforces it against an
 * untyped payload, but the repository only *accepts* these fields, so a
 * caller cannot widen it by constructing the input differently.
 */
export type EventUpdate = Partial<{
  name: string;
  abbreviation: string;
  image: string | null;
  nomActive: boolean;
  nomDate: number | null;
  nomTime: number | null;
  nomDuration: number | null;
  awardsActive: boolean;
  awardsDate: number | null;
  awardsTime: number | null;
  awardsDuration: number | null;
  liveResults: boolean;
}>;

/** Postgres/Prisma "record to update not found". */
function isRecordNotFound(error: unknown): boolean {
  return (
    !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2025'
  );
}

export const eventRepository = {
  /** Throws NotFoundError rather than returning null — callers would forget to check. */
  async findById(id: number): Promise<Event> {
    const event = await db.event.findUnique({ where: { id }, select: SELECT });
    if (!event) throw new NotFoundError('event', id);
    return toEvent(event);
  },

  /**
   * Returns null on a miss: `/award-shows/[abbreviation]` is a public URL and
   * anyone can type a slug that is not an award show.
   *
   * Matches exactly rather than case-insensitively. Every stored abbreviation
   * is lowercase, and widening this needs a real decision about which casing
   * is canonical in a URL.
   */
  async findByAbbreviation(abbreviation: string): Promise<Event | null> {
    const event = await db.event.findFirst({ where: { abbreviation }, select: SELECT });
    return event && toEvent(event);
  },

  /** Every award show, ordered for display — the order the source API served. */
  async findAll(): Promise<Event[]> {
    const events = await db.event.findMany({ select: SELECT, orderBy: { name: 'asc' } });
    return events.map(toEvent);
  },

  /**
   * Batch-load by id, skipping ids that do not resolve.
   *
   * Accepts bigint because this schema has no foreign keys and the referencing
   * column disagrees on width: events.id is integer, but awards.event_id is
   * bigint. A dangling reference is therefore possible, and must not take down
   * a page render.
   */
  async findManyByIds(ids: readonly (number | bigint)[]): Promise<Event[]> {
    if (ids.length === 0) return [];
    const events = await db.event.findMany({
      where: { id: { in: ids.map(Number) } },
      select: SELECT,
      orderBy: { id: 'asc' },
    });
    return events.map(toEvent);
  },

  /**
   * The shows currently announcing nominations or handing out awards.
   *
   * An array, not the single row the source app's `getLiveEvent` returned:
   * nothing in the schema stops two shows being live at once, and the
   * dashboard already filtered a list rather than trusting that `findOne`.
   * Empty for most of the year.
   */
  async findActive(): Promise<Event[]> {
    const events = await db.event.findMany({
      where: { OR: [{ nomActive: true }, { awardsActive: true }] },
      select: SELECT,
      orderBy: { name: 'asc' },
    });
    return events.map(toEvent);
  },

  /**
   * Change a show's editable fields (T26).
   *
   * The six schedule columns are bigint in the database; `null` clears one,
   * `undefined` (the field simply absent from `input`) leaves it alone. Every
   * other field behaves the same way — this is a `PATCH`, not a `PUT`, so an
   * admin editing just the live flags does not have to resend the whole row.
   *
   * Throws NotFoundError rather than letting Prisma's P2025 escape as a raw
   * error — the same reason every other write in this layer catches it.
   */
  async update(id: number, input: EventUpdate): Promise<Event> {
    const {
      nomDate,
      nomTime,
      nomDuration,
      awardsDate,
      awardsTime,
      awardsDuration,
      ...rest
    } = input;

    const toBigInt = (value: number | null | undefined) =>
      value === undefined ? undefined : value === null ? null : BigInt(value);

    try {
      const row = await db.event.update({
        where: { id },
        data: {
          ...rest,
          nomDate: toBigInt(nomDate),
          nomTime: toBigInt(nomTime),
          nomDuration: toBigInt(nomDuration),
          awardsDate: toBigInt(awardsDate),
          awardsTime: toBigInt(awardsTime),
          awardsDuration: toBigInt(awardsDuration),
          updatedAt: new Date(),
        },
        select: SELECT,
      });
      return toEvent(row);
    } catch (error) {
      if (isRecordNotFound(error)) throw new NotFoundError('event', id);
      throw error;
    }
  },
};
