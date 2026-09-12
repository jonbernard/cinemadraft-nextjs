import type { Metadata } from 'next';

/**
 * The origin every canonical, sitemap entry and OG URL resolves against.
 *
 * 🔴 Not `VERCEL_URL`. That variable is per-deployment, so every preview would
 * publish canonicals and OG URLs pointing at itself — which tells a crawler the
 * preview is the real page, and puts preview URLs in shared link previews. The
 * apex is the only correct answer here even while the app is served from
 * `next.cinemadraft.com`, because the canonical names where the page *will*
 * live, and phase 13 is what moves it there.
 */
export const SITE_URL = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cinemadraft.com',
);

/** `Sinners (2025) · Cinemadraft` — the template Next applies to page titles. */
export const TITLE_TEMPLATE = '%s · Cinemadraft';

/**
 * The absolute canonical for a path.
 *
 * Query strings are dropped deliberately: `?year=` and `?page=` are the same
 * document seen from a different angle, and letting each variant claim its own
 * canonical splits the page's standing across dozens of near-duplicates.
 */
export function canonical(path: string): string {
  return new URL(path.split('?')[0] ?? '/', SITE_URL).toString();
}

/**
 * For anything a stranger should not meet in a search result.
 *
 * 🔴 Not a security boundary — `proxy.ts` is (D44). A league page is public on
 * purpose so a pasted link opens, and this only keeps it out of the index.
 */
export const NOINDEX: Metadata['robots'] = { index: false, follow: false };

/**
 * What a film page tells a crawler about itself, as schema.org `Movie` (§6).
 *
 * 🔴 **Only fields the page actually holds.** Every property here is omitted
 * rather than guessed when the data is missing — a `datePublished` invented
 * from a year, or a `description` echoing the title, is worse than silence:
 * structured data is machine-read, so a wrong field is asserted with the same
 * confidence as a right one and there is no reader to notice.
 *
 * 🔴 **No `aggregateRating`, deliberately.** OMDb gives us IMDb's score and
 * vote count, and `aggregateRating` on this page would claim it as *this*
 * page's rating — Google's own guidance is that it must reflect ratings
 * collected by the site itself. Cinemadraft collects points, not stars.
 *
 * `director` comes from the Directing department rather than the first crew
 * member: TMDB lists writers, editors and producers there too, and a film with
 * no credited director in the response simply has no `director` key.
 */
export type MovieJsonLdInput = {
  tmdbId: string;
  title: string;
  overview: string | null;
  tagline: string | null;
  releaseDate: Date | null;
  runtimeMinutes: number | null;
  language: string | null;
  genres: readonly string[];
  posterUrls: readonly string[];
  crew: readonly {
    department: string;
    people: readonly { name: string; job: string }[];
  }[];
};

export function movieJsonLd(film: MovieJsonLdInput): Record<string, unknown> {
  const directors = film.crew
    .filter((group) => group.department === 'Directing')
    .flatMap((group) => group.people)
    .filter((person) => person.job === 'Director')
    .map((person) => ({ '@type': 'Person', name: person.name }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: film.title,
    url: canonical(`/films/${film.tmdbId}`),
    ...(film.posterUrls[0] ? { image: film.posterUrls[0] } : {}),
    // The synopsis first, the tagline only as a fallback: a tagline is written
    // to intrigue rather than to describe, which is the wrong job here.
    ...((film.overview ?? film.tagline)
      ? { description: film.overview ?? film.tagline }
      : {}),
    // 🔴 The date in UTC, not the server's zone. `toISOString` is what keeps a
    // film released on the 1st from being published on the 31st for a crawler
    // hitting a machine west of UTC — the same reasoning as the browse
    // grouping, and the same bug if it is forgotten.
    ...(film.releaseDate
      ? { datePublished: film.releaseDate.toISOString().slice(0, 10) }
      : {}),
    // ISO 8601 duration, which is what schema.org asks for — "PT128M", not 128.
    ...(film.runtimeMinutes ? { duration: `PT${film.runtimeMinutes}M` } : {}),
    ...(film.language ? { inLanguage: film.language } : {}),
    ...(film.genres.length > 0 ? { genre: [...film.genres] } : {}),
    ...(directors.length > 0 ? { director: directors } : {}),
  };
}
