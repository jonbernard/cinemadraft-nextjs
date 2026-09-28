/**
 * The season an owner may open, or null (D131).
 *
 * One beyond the league's newest season, and only once the site's active year
 * (the admin season control) is on it. 🔴 This is the one condition the
 * owner's open question 1 would change: a league that skipped a season
 * (newest 2025, site on 2027) gets no offer and needs the admin. The owner
 * accepted that default on 2026-09-27.
 *
 * `seasons` is newest first. A league with none has nothing to open: that is
 * league creation, not a new season.
 */
export function canOpenSeason({
  activeYear,
  seasons,
}: {
  activeYear: number;
  seasons: readonly number[];
}): number | null {
  const newest = seasons[0];
  return newest != null && activeYear === newest + 1 ? activeYear : null;
}
