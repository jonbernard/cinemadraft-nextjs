/**
 * Whether a show still needs its nominations, or its winners, entered for a
 * season — worked out from its dates and what is already in, never from a flag.
 *
 * 🔴 **The owner's call: "use dates for nom_active".** The port had read
 * `events.nom_active` as "still needs nominations", but nothing in the port
 * ever set it true — in the source it was a side effect of an admin choosing
 * the Nominations view — so the marker could only go out, never come on. The
 * source's own "Events needing updates" card never read the flag either: it
 * derived both answers from dates and data (`server/routes/events.js`,
 * `requiresNoms` / `requiresWinners`). This is that card's rule, with three
 * deliberate differences:
 *
 * - **The instant is `date + time`**, as `lib/services/ical.ts` and the dates
 *   spec have it (`nom_date` is the event's local midnight, `nom_time` the
 *   offset, which runs past 24 h for an evening ceremony). The source added
 *   the *duration* to the bare date and never the time, so a nominations
 *   announcement at 8:00 AM ET counted as due at 00:30 UTC that day.
 * - **The instant has to fall in the season's window** (1 August of the prior
 *   year to 31 July — the same window `scripts/award-import.mjs` uses). A show
 *   holds one row of dates, overwritten each season, so at the start of a
 *   season every show still carries last year's past dates; without the window
 *   all twelve would read "needs nominations" before any had been announced.
 * - **Winners are outstanding while any category that has nominees has no
 *   winner.** The source asked only whether *no* category had one, so a show
 *   half-entered on the night read as done. A category with no nominees is
 *   not counted: nothing in it can win.
 */
export type EntryStatus = { needsNominations: boolean; needsWinners: boolean };

export type ShowDates = {
  nomDate: number | null;
  nomTime: number | null;
  awardsDate: number | null;
  awardsTime: number | null;
};

export type SeasonEntries = {
  /** Nominations entered for the season, across every category. */
  nominations: number;
  /** Categories that have at least one nominee this season. */
  categoriesWithNominees: number;
  /** Of those, how many have a winner. */
  categoriesDecided: number;
};

/** The same window as `seasonWindow` in `scripts/award-import.mjs`. */
function inSeason(instant: number, season: number): boolean {
  return instant >= Date.UTC(season - 1, 7, 1) && instant < Date.UTC(season, 7, 1);
}

/** The real moment: the event's local midnight plus the offset (dates spec). */
function instantOf(date: number | null, time: number | null): number | null {
  return date == null ? null : date + (time ?? 0);
}

function due(instant: number | null, season: number, now: number): boolean {
  return instant != null && inSeason(instant, season) && instant <= now;
}

export function entryStatus(
  dates: ShowDates,
  season: number,
  entries: SeasonEntries,
  now: number = Date.now(),
): EntryStatus {
  return {
    needsNominations:
      due(instantOf(dates.nomDate, dates.nomTime), season, now) &&
      entries.nominations === 0,
    needsWinners:
      due(instantOf(dates.awardsDate, dates.awardsTime), season, now) &&
      entries.categoriesDecided < entries.categoriesWithNominees,
  };
}
