import { availableYearRepository } from '@/lib/repositories/available-years';
import { eventRepository } from '@/lib/repositories/events';

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
 * Deliberately uncached for now. `PLAN.md` asks for this to be cached and
 * tagged `active-year`, which in Next 16 means `'use cache'` and therefore
 * `cacheComponents` — and that flag turns every uncached read during
 * prerendering into a build error, so adopting it requires Suspense
 * boundaries drawn around every session-dependent page. Those pages do not
 * exist yet; drawing their boundaries before they do would be guessing. The
 * cost of waiting is one indexed lookup against a ten-row table per request.
 * See D42.
 */
export async function getActiveYear(): Promise<number> {
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
export async function getSeasons(): Promise<number[]> {
  return availableYearRepository.listYears();
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
  events: readonly {
    id: number;
    name: string | null;
    abbreviation: string | null;
    nomDate: number | null;
    awardsDate: number | null;
  }[],
): SeasonPhase[] {
  const now = Date.now();

  return events
    .flatMap((event) => {
      const shared = {
        eventId: event.id,
        name: event.name,
        abbreviation: event.abbreviation,
      };
      return [
        {
          ...shared,
          key: `${event.id}-nominations`,
          phase: 'nominations' as const,
          date: event.nomDate,
          complete: event.nomDate != null && event.nomDate < now,
        },
        {
          ...shared,
          key: `${event.id}-ceremony`,
          phase: 'ceremony' as const,
          date: event.awardsDate,
          complete: event.awardsDate != null && event.awardsDate < now,
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.date ?? Number.POSITIVE_INFINITY) - (b.date ?? Number.POSITIVE_INFINITY),
    );
}

/** Every scoring moment in the calendar, read from the events table. */
export async function getSeasonPhases(): Promise<SeasonPhase[]> {
  return toSeasonPhases(await eventRepository.findAll());
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
