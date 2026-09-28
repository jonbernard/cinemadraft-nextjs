import type { League } from '@/lib/repositories/leagues';

/**
 * A league's status, for one of its seasons (D130).
 *
 * 🔴 `leagues.drafting_status` is one column for every season. The moment
 * the next season opens it goes back to `pending`, and every read of it then
 * spoke for the season just finished too: the 2026 board read "pending",
 * `randomiseGroups({ year: 2026 })` would re-deal a season with picks in it,
 * and corrections to 2026 were refused as "not started". The status belongs
 * to `active_year`. Earlier seasons are over; later ones are not open.
 *
 * A league with no `active_year` (none in the restored data, but the column
 * is nullable) keeps the old reading: one status for every season.
 */
export function seasonStatus(
  league: Pick<League, 'activeYear' | 'draftingStatus'>,
  year: number,
): League['draftingStatus'] {
  if (league.activeYear == null || year === league.activeYear) {
    return league.draftingStatus;
  }
  return year < league.activeYear ? 'complete' : null;
}

/** Whether `year` is the season `drafting_status` speaks for, so a status write lands on it. */
export function isCurrentSeason(
  league: Pick<League, 'activeYear'>,
  year: number,
): boolean {
  return league.activeYear == null || year === league.activeYear;
}
