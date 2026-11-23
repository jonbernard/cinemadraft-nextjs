import { eventDateRepository } from '@/lib/repositories/event-dates';
import { type Event, eventRepository } from '@/lib/repositories/events';
import { nominationRepository } from '@/lib/repositories/nominations';
import { winnerRepository } from '@/lib/repositories/winners';
import { inSeason, seasonOffset } from '@/lib/utils/season-window';
import { getActiveYear } from './season';

/**
 * One of a season's scoring moments: a show's nominations, or its ceremony
 * (P16.T13). The season view, the standings, the seat page and the race all
 * read these, so they agree on what a moment is and in what order they come.
 */
export type Moment = {
  /** `${eventId}-nominations` | `${eventId}-ceremony`, the rail's keys. */
  key: string;
  eventId: number;
  abbreviation: string;
  name: string;
  phase: 'nominations' | 'ceremony';
  /** This season's date (epoch ms), or null: unscheduled, or a season with no stored dates. */
  date: number | null;
  /** Sort key: `seasonOffset` of `date`, or of the show's current column when undated. */
  order: number;
  /** Data, not the clock: finished once its rows exist; live while `awards_active`. */
  state: 'upcoming' | 'live' | 'finished';
  nominations: number;
  winners: number;
};

type MomentEvent = Pick<
  Event,
  | 'id'
  | 'abbreviation'
  | 'name'
  | 'hasCeremony'
  | 'nomDate'
  | 'awardsDate'
  | 'awardsActive'
>;

/**
 * 🔴 `state` is read from the rows, never from the date. A season with no
 * stored dates (`event_dates`, D134) would finish none of its moments under a
 * clock rule; and a ceremony entered late is still finished once its winners
 * are in.
 *
 * `live` is `awards_active` in the active year only: the flag is about
 * tonight's broadcast, and a past season's ceremony with winners is finished
 * whatever the flag says now.
 */
export function toMoments(input: {
  events: readonly MomentEvent[];
  year: number;
  /** The site's active season: the only one a show can be on air in. */
  activeYear: number;
  nominations: ReadonlyMap<number, number>;
  winners: ReadonlyMap<number, number>;
  /** P16.T18: a show's stored dates for `year`, which win over the events columns. */
  datesForYear?: ReadonlyMap<
    number,
    { nomDate: number | null; awardsDate: number | null }
  >;
}): Moment[] {
  const { events, year, activeYear, datesForYear } = input;

  const place = (stored: number | null | undefined, column: number | null) => {
    const date =
      stored !== undefined
        ? stored
        : column != null && inSeason(column, year)
          ? column
          : null;
    // An undated moment keeps the calendar's place for its show, so a past
    // season reads in this year's order; with no date anywhere it goes last.
    const anchor = date ?? column;
    return {
      date,
      order: anchor == null ? Number.POSITIVE_INFINITY : seasonOffset(anchor),
    };
  };

  return events
    .flatMap((event) => {
      const stored = datesForYear?.get(event.id);
      const nominations = input.nominations.get(event.id) ?? 0;
      const winners = input.winners.get(event.id) ?? 0;
      const shared = {
        eventId: event.id,
        abbreviation: event.abbreviation ?? '',
        name: event.name ?? '',
        nominations,
        winners,
      };
      const list: Moment[] = [
        {
          ...shared,
          key: `${event.id}-nominations`,
          phase: 'nominations',
          ...place(stored?.nomDate, event.nomDate),
          state: nominations > 0 ? 'finished' : 'upcoming',
        },
      ];
      // A show with no ceremony (D129, the AFI) has one moment.
      if (event.hasCeremony) {
        const live = event.awardsActive === true && year === activeYear;
        list.push({
          ...shared,
          key: `${event.id}-ceremony`,
          phase: 'ceremony',
          ...place(stored?.awardsDate, event.awardsDate),
          state: live ? 'live' : winners > 0 ? 'finished' : 'upcoming',
        });
      }
      return list;
    })
    .sort(
      (a, b) =>
        a.order - b.order ||
        (a.phase === b.phase ? 0 : a.phase === 'nominations' ? -1 : 1) ||
        a.name.localeCompare(b.name),
    );
}

/** A season's moments: the events, their stored dates for the year, and one grouped count each of nominations and winners. */
export async function getSeasonMoments(year: number): Promise<Moment[]> {
  const [events, nominations, winners, activeYear, datesForYear] = await Promise.all([
    eventRepository.findAll(),
    nominationRepository.countByEventForYear(year),
    winnerRepository.countByEventForYear(year),
    getActiveYear(),
    eventDateRepository.findByYear(year),
  ]);
  return toMoments({ events, year, activeYear, nominations, winners, datesForYear });
}
