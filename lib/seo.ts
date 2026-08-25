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
