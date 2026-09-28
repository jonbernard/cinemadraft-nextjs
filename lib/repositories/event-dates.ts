import { db } from '@/lib/db';

/** One show's schedule for one season, epoch ms like `Event`'s columns. */
export type EventDates = {
  nomDate: number | null;
  nomTime: number | null;
  awardsDate: number | null;
  awardsTime: number | null;
};

const ms = (value: bigint | null): number | null =>
  value === null ? null : Number(value);

/**
 * Each show's dates per season (D134). `events` holds only the current
 * season's, overwritten every year; this is what says when a past season's
 * moments happened. Written by the M3 backfill (2017–2026) and by the
 * award-entry skill's `set-dates`.
 */
export const eventDateRepository = {
  /** eventId → that show's dates in `year`; a show with no row is absent. */
  async findByYear(year: number): Promise<Map<number, EventDates>> {
    const rows = await db.eventDate.findMany({
      where: { year },
      select: {
        eventId: true,
        nomDate: true,
        nomTime: true,
        awardsDate: true,
        awardsTime: true,
      },
    });
    return new Map(
      rows.map((row) => [
        row.eventId,
        {
          nomDate: ms(row.nomDate),
          nomTime: ms(row.nomTime),
          awardsDate: ms(row.awardsDate),
          awardsTime: ms(row.awardsTime),
        },
      ]),
    );
  },

  /**
   * Set a show's dates for `year` (the "Edit this show" dialog): one row per
   * show per season, created or replaced. All four empty removes the row,
   * which is how a season with no dates is represented.
   */
  async save(year: number, eventId: number, dates: EventDates): Promise<void> {
    const where = { year_eventId: { year, eventId } };
    if (Object.values(dates).every((value) => value == null)) {
      await db.eventDate.deleteMany({ where: { year, eventId } });
      return;
    }
    const big = (value: number | null) => (value == null ? null : BigInt(value));
    const data = {
      nomDate: big(dates.nomDate),
      nomTime: big(dates.nomTime),
      awardsDate: big(dates.awardsDate),
      awardsTime: big(dates.awardsTime),
    };
    await db.eventDate.upsert({
      where,
      create: { year, eventId, ...data },
      update: { ...data, updatedAt: new Date() },
    });
  },
};
