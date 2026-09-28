/**
 * Film URLs are title + TMDB id, for every film, held or not (D133):
 * `/films/coyote-vs-acme-1204680`.
 *
 * - **The id is authoritative.** The route reads the trailing digits and
 *   nothing else decides which film it is.
 * - **The slug part is derived from a title, here, at render.** There is no
 *   column: a title correction simply moves the canonical spelling, and the
 *   route permanently redirects the old one.
 * - **A title with nothing Latin left** (`弟弟`) has an empty slug part, so its
 *   URL is the bare id, which the route does not redirect.
 *
 * Import-free, so client components can spell a film URL too. Every film link
 * goes through `filmHref`; `scripts/layering.sh` refuses a hand-built one.
 */

/** NFKD, then every combining mark dropped: `Amélie` → `Amelie`, `TÁR` → `TAR`. */
export function foldAccents(text: string): string {
  return text.normalize('NFKD').replace(/\p{Diacritic}/gu, '');
}

const MAX_SLUG = 80;

/** Accent-folded, lowercased, `&` → `and`, apostrophes dropped, other runs → `-`, trimmed, ≤ 80 chars at a word break. */
export function filmSlugPart(title: string | null | undefined): string {
  const slug = foldAccents(title ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= MAX_SLUG) return slug;
  const cut = slug.slice(0, MAX_SLUG);
  const lastBreak = cut.lastIndexOf('-');
  return lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
}

/** The one place a film URL is spelled. `/films/<slug>-<id>`, or `/films/<id>` when the slug part is empty. */
export function filmHref(film: {
  tmdbId: string | number;
  title: string | null | undefined;
}): string {
  const slug = filmSlugPart(film.title);
  return `/films/${slug ? `${slug}-` : ''}${film.tmdbId}`;
}

// The slug part is at most MAX_SLUG characters, so anything longer is refused
// before a TMDB request is spent on it.
const SEGMENT = /^(?:([a-z0-9-]{1,80})-)?(\d{1,12})$/;

/** The trailing id and the slug part it arrived with, or null for anything that is not `[a-z0-9-]*\d{1,12}`. */
export function parseFilmSegment(
  segment: string,
): { tmdbId: string; slugPart: string } | null {
  const match = SEGMENT.exec(segment);
  return match ? { tmdbId: match[2] as string, slugPart: match[1] ?? '' } : null;
}
