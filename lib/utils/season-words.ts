/**
 * The season view's words for dates, places and counts (P16.T15–T16).
 *
 * Pure, and outside the components because Biome's
 * `useComponentExportOnlyModules` forbids exporting them beside one. Every
 * date is UTC: show dates are stored as UTC midnight of the announcement day,
 * and a formatter in the reader's zone would put it on the previous day west
 * of Greenwich (the same reason as `SeasonStepper`).
 */
const DAY_MS = 86_400_000;

const day = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });

/** "Mar 15". */
export function showDay(date: number): string {
  return day.format(date);
}

/** "Sun". */
export function showWeekday(date: number): string {
  return weekday.format(date);
}

/**
 * How far off a moment is, in words. A date that has passed with the moment
 * still unfinished is waiting on its results, never "in -3 days".
 */
export function countdown(date: number, now: number): string {
  if (now >= date && now < date + DAY_MS) return 'today';
  if (now >= date) return 'results still to come';
  const days = Math.ceil((date - now) / DAY_MS);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** "1 nomination", "188 nominations". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
