/**
 * TMDB's own CDN. Every poster and backdrop in the app comes from it, already
 * sized by the path segment (`/t/p/w185/`, `/t/p/w500/`).
 */
const PASS_THROUGH_HOSTS = new Set(['image.tmdb.org']);

/**
 * Whether a remote image should go through Vercel's image optimizer.
 *
 * 🔴 False for TMDB, deliberately. Its URLs already name a width, so
 * optimizing them again buys format conversion only — and it buys it per
 * variant, on pages that render dozens of posters at once. The logos and
 * avatars are the opposite case: few, small, and repeated across pages, so
 * they convert once and cache well.
 *
 * A value that is not an absolute URL is never optimized. `events.image` held
 * app-relative paths before this phase, and a row that escapes the migration
 * must degrade to a plain fetch rather than throw inside a render.
 */
export function shouldOptimize(url: string): boolean {
  try {
    return !PASS_THROUGH_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
