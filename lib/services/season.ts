import { availableYearRepository } from '@/lib/repositories/available-years';

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
