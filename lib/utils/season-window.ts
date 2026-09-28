/**
 * A season runs 1 August of the year before to 31 July: the award-import
 * script's `seasonWindow`, and the window `entryStatus` has always used. The
 * 2026 season really runs from the AFI's nominations in December 2025 to the
 * Oscars in March 2026, so there are months of margin at both ends.
 */
export function seasonStart(season: number): number {
  return Date.UTC(season - 1, 7, 1);
}

export function inSeason(instant: number, season: number): boolean {
  return instant >= seasonStart(season) && instant < seasonStart(season + 1);
}

/** Milliseconds into whichever season `instant` falls in: an order key that ignores the year. */
export function seasonOffset(instant: number): number {
  const date = new Date(instant);
  const season =
    date.getUTCMonth() >= 7 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  return instant - seasonStart(season);
}
