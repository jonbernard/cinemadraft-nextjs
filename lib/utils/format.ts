/**
 * The film page's three formatters.
 *
 * They live here rather than beside `FilmFacts` for two reasons: Biome's
 * `useComponentExportOnlyModules` forbids exporting a non-component beside
 * components, and it is right — these are pure functions with their own tests
 * and no need to be pulled into a component bundle to be used.
 */

/**
 * A runtime in hours and minutes, or null when it is unknown.
 *
 * 🔴 The source printed **1 hour 41 minutes for every film in the catalogue**:
 * `moment.duration(101, 'minutes')` is a literal and `movie.runtime` was fetched
 * and never read (`src/pages/movie/index.jsx:88`, PARITY bug 12). Recorded
 * because the number looks entirely plausible, which is why nobody noticed.
 *
 * Words rather than "2h 9m": this is a fact in a prose column, and the
 * abbreviated form belongs in a data cell.
 */
export function formatRuntime(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'minute' : 'minutes'}`);

  return parts.join(' ');
}

/**
 * A dollar amount, or null.
 *
 * 🔴 TMDB stores 0 for "unknown", and the source formatted it anyway — so an
 * announced-but-unmade film's page claimed a budget of `$0`.
 * `lib/external/tmdb-film.ts` already maps 0 to null; this guards the same case
 * again, because a 0 arriving here would print a confident wrong number rather
 * than fail visibly.
 *
 * The locale is pinned to `en-US` deliberately: the amounts come from TMDB in US
 * dollars, so it is a property of the data rather than of the reader, and a
 * German reader must not see `30.000.000 $` as though the figure were euros.
 */
export function formatMoney(amount: number | null): string | null {
  if (amount == null || amount <= 0) return null;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** A release date. */
export function formatReleaseDate(date: Date | null): string | null {
  return formatDay(date);
}

/**
 * A calendar day a person reads — `August 22, 2026`, never `08/22/26`.
 *
 * 🔴 The time zone is explicit. Without it a film released on the 1st renders as
 * the previous month for every reader west of UTC — two people looking at the
 * same page would disagree about when a film came out, and the browse page's
 * month grouping would disagree with the film page's date.
 */
export function formatDay(date: Date | null): string | null {
  if (!date) return null;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}
