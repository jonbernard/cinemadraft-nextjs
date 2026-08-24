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
 * avatars are the opposite case: the source images are oversized for their
 * display box (a Gravatar stored at `?s=480` renders at 56px on a member
 * page), so running them through the optimizer once and caching the result
 * is a real size win rather than a repeated cost.
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
