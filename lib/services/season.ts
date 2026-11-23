import { cachedFromDb } from '@/lib/external/cache';
import { availableYearRepository } from '@/lib/repositories/available-years';
import { eventRepository } from '@/lib/repositories/events';
import { inSeason } from '@/lib/utils/season-window';

/**
 * The season the app is currently showing (D22).
 *
 * This replaces `NEXT_PUBLIC_ACTIVE_YEAR`, a build-time constant read in about
 * ten client files, which made changing seasons a redeploy every January.
 *
 * Falls back to the newest year rather than throwing when nothing is flagged
 * active. "No active row" is a state the table can genuinely be in — it is
 * what it looked like before the seeding migration, and the partial unique
 * index permits zero as readily as one. A blank site in January is a worse
 * failure than showing the most recent season.
 *
 * Cached through `cachedFromDb` rather than `'use cache'`: the framework route
 * needs `cacheComponents`, which turns every uncached read during prerendering
 * into a build error (D42). Any write purges it, including `set-active-year`.
 */
export function getActiveYear(): Promise<number> {
  return cachedFromDb('active-year', readActiveYear);
}

async function readActiveYear(): Promise<number> {
  const active = await availableYearRepository.findActive();
  if (active?.year != null) return active.year;

  const years = await availableYearRepository.listYears();
  const newest = years[0];
  if (newest == null) {
    // Unreachable with data restored; a seeded database always has seasons.
    // Throwing beats returning a guessed year, which would silently scope
    // every query on the page to a season that does not exist.
    throw new Error('no seasons exist');
  }
  return newest;
}

/**
 * Every season, newest first — for the year picker.
 *
 * Separate from `getActiveYear` because the two answer different questions:
 * this one is "what may I look at", that one is "what am I looking at now".
 */
export function getSeasons(): Promise<number[]> {
  return cachedFromDb('seasons', () => availableYearRepository.listYears());
}

/**
 * Every award show, through the public-read cache — the events table changes a
 * few times a season. For the pages, not for a stream's poll.
 */
export function getAllEvents() {
  return cachedFromDb('events', () => eventRepository.findAll());
}

/**
 * One box per scoring moment, for every show in the calendar.
 *
 * 🔴 Extracted from `getDashboard` by P18.T5's wiring, and it is shared rather
 * than copied: `/how-it-works` renders the same season shape for a signed-out
 * stranger, and a second copy of "a show contributes two phases" would drift
 * the first time either page learned something the other did not. The
 * dashboard now calls this.
 *
 * `nom_date` and `awards_date` are separate columns, and emitting only the
 * second is why the dashboard once showed no nominations date though
 * nominations are half of what scores.
 *
 * `complete` is a date comparison, per phase. `nomActive` / `awardsActive`
 * mark the live broadcast window, not whether the moment has passed, and using
 * them here would light up "complete" for a ceremony that is on air right now.
 *
 * Undated phases sort last rather than to 1970: an unscheduled moment is the
 * far future, not the past.
 */
export function toSeasonPhases(
  events: readonly PhaseEvent[],
  season: number,
  now: number = Date.now(),
): SeasonPhase[] {
  // 🔴 Only this season's dates (P16.T2). A show holds one row of dates,
  // overwritten each season, so once the active year moves on every show
  // still carries last season's, all past, and without this the rail would
  // call the new season finished the day it opens. Out of season is "not
  // scheduled yet", which is exactly what it is.
  const own = (date: number | null) =>
    date != null && inSeason(date, season) ? date : null;

  return events
    .flatMap((event) => {
      const nomDate = own(event.nomDate);
      const awardsDate = own(event.awardsDate);
      const shared = {
        eventId: event.id,
        name: event.name,
        abbreviation: event.abbreviation,
      };
      const nominations: SeasonPhase = {
        ...shared,
        key: `${event.id}-nominations`,
        phase: 'nominations',
        date: nomDate,
        complete: nomDate != null && nomDate < now,
      };
      // 🔴 A show with no ceremony (D129, the AFI) has one moment. Emitting a
      // ceremony box for it anyway is what read "11 of 12 · Next · date TBA"
      // for the rest of the year: an undated box that could never complete.
      if (!event.hasCeremony) return [nominations];
      return [
        nominations,
        {
          ...shared,
          key: `${event.id}-ceremony`,
          phase: 'ceremony' as const,
          date: awardsDate,
          complete: awardsDate != null && awardsDate < now,
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.date ?? Number.POSITIVE_INFINITY) - (b.date ?? Number.POSITIVE_INFINITY),
    );
}

/** The slice of an event the season rail reads. */
export type PhaseEvent = {
  id: number;
  name: string | null;
  abbreviation: string | null;
  hasCeremony: boolean;
  nomDate: number | null;
  awardsDate: number | null;
};

/** Every scoring moment in the calendar, read from the events table. */
export async function getSeasonPhases(): Promise<SeasonPhase[]> {
  // The rows are cached; `toSeasonPhases` reads the clock, so it runs after.
  const [events, season] = await Promise.all([getAllEvents(), getActiveYear()]);
  return toSeasonPhases(events, season);
}

/**
 * A scoring moment on the season calendar — a show's nominations, or its
 * ceremony. Structurally the dashboard's `SeasonPhase`, which re-exports this.
 */
export type SeasonPhase = {
  /** `${eventId}-nominations` / `${eventId}-ceremony` — unique per box, stable across renders. */
  key: string;
  eventId: number;
  phase: 'nominations' | 'ceremony';
  name: string | null;
  abbreviation: string | null;
  /** Epoch milliseconds, not a Date; null means not scheduled yet. */
  date: number | null;
  complete: boolean;
};
