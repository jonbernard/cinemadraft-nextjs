import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * Who may reach what, and every route there is to decide it for.
 *
 * `proxy.ts` used to hold both halves: `createRouteMatcher` with the list
 * below, and `auth.protect()` for everything it did not match. Clerk
 * deprecated that helper — a path list can diverge from how Next actually
 * routes a request — so the checks moved onto the resources themselves. What
 * did not move is D40's mechanism, and it is the whole reason this file
 * exists: **the list enumerates PUBLIC routes**, everything else is protected,
 * and a route nobody remembered to think about lands in the protected half.
 *
 * Forgetting to list a page makes it protected, which is visible and harmless.
 * Enumerating the protected ones instead would leak a page the first time
 * somebody forgot, silently, because the page renders perfectly to a stranger.
 *
 * Two consumers, deliberately:
 *
 *   `test/route-protection.test.ts` pins this list verbatim and asserts every
 *   route NOT on it carries a page gate in its own source. That is the check
 *   that catches a forgotten one, and it runs in milliseconds.
 *
 *   `e2e/route-protection.spec.ts` visits every one of them signed out, in a
 *   browser, against a production build. That is the check that catches a gate
 *   which is present and does not work.
 */

/**
 * Repo root, found by walking up for `app/layout.tsx`.
 *
 * 🔴 Not `import.meta.dirname`, which is the obvious spelling and breaks the
 * half of this file's job that matters most: Playwright transpiles specs to
 * CommonJS, where `import.meta` is a syntax error, so the e2e guard would fail
 * to load rather than run. Not `process.cwd()` either — it is right for both
 * runners today and silently wrong the first time something runs from a
 * subdirectory. This is loud when it is wrong.
 */
const ROOT = (() => {
  let dir = process.cwd();
  while (!existsSync(join(dir, 'app', 'layout.tsx'))) {
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error('test/route-protection.ts cannot find the repo root');
    dir = parent;
  }
  return dir;
})();
const APP = join(ROOT, 'app');

/**
 * Every route file Next serves, as the URL path it answers on.
 *
 * Derived by walking `app/` rather than being written down, so a route added
 * tomorrow is classified whether or not anybody updates a list. `(group)`
 * segments are directory names Next erases from the URL, and are erased here
 * the same way; dynamic segments are kept in their source spelling
 * (`/leagues/[id]`), because that is what makes an entry greppable back to the
 * file that serves it.
 *
 * 🔴 It throws on a route file it does not recognise. Next keeps adding
 * conventions — `default.tsx`, `manifest.ts`, `sitemap.ts` was one once — and
 * the failure mode of quietly skipping one is a served route that no guard
 * ever classifies. A throw makes the next convention somebody adopts fail the
 * suite until it has been placed on one side of the line or the other.
 */
export function discoverRoutes(): Route[] {
  const routes: Route[] = [];

  const walk = (dir: string, url: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // `(app)`, `(marketing)` — a grouping, not a URL segment.
        const segment = /^\(.*\)$/.test(entry.name) ? '' : `/${entry.name}`;
        walk(join(dir, entry.name), url + segment);
        continue;
      }

      const suffix = routeSuffix(entry.name);
      if (suffix === null) continue;
      routes.push({
        path: `${url}${suffix}` || '/',
        file: relative(ROOT, join(dir, entry.name)),
      });
    }
  };

  walk(APP, '');
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

/** A served URL and the file that serves it — the file is what the guard reads for a gate. */
export type Route = { path: string; file: string };

/** What a file in a route directory adds to that directory's URL, or null if it serves nothing. */
function routeSuffix(file: string): string | null {
  switch (file) {
    case 'page.tsx':
    case 'route.ts':
      return '';
    // Metadata routes. Next serves these at a path of their own beneath the
    // directory they sit in, so they are routes and they are classified.
    case 'opengraph-image.tsx':
      return '/opengraph-image';
    case 'robots.ts':
      return '/robots.txt';
    case 'sitemap.ts':
      return '/sitemap.xml';
    // Everything that renders *around* a route rather than being one, plus the
    // tests and stories that sit beside them.
    case 'layout.tsx':
    case 'loading.tsx':
    case 'error.tsx':
    case 'global-error.tsx':
    case 'not-found.tsx':
    case 'providers.tsx':
    case 'globals.css':
    case 'icon.svg':
    case 'apple-icon.png':
    case 'favicon.ico':
    case '.gitkeep':
      return null;
    default:
      if (/\.(test|spec|stories)\.tsx?$/.test(file)) return null;
      throw new Error(
        `test/route-protection.ts does not know whether app/**/${file} serves a route. ` +
          'Add it to routeSuffix() — as a route if Next serves it, as null if it does not.',
      );
  }
}

/**
 * The routes a stranger may reach, and no more.
 *
 * Every entry here was a deliberate ruling, and the reasoning is kept with it
 * because this is the file where "public" is decided. Anything absent is
 * protected and must carry `requirePageUser()` or `requirePageAdmin()` in its
 * own source — the test next door checks that, per route, by name.
 *
 * 🔴 One route per line, no wildcards. The old list matched `/leagues/(.*)`,
 * which covered `/leagues/[id]/draft` and would have covered any page added
 * under `/leagues/` later — the proxy's own comment flagged that as inverting
 * D40 and asked future authors to remember. Per-file entries remove the need
 * to remember: a new page under `/leagues/` is not on this list, so it is
 * protected, and making it public is an edit somebody reviews.
 */
export const PUBLIC_ROUTES = [
  // The dashboard. Public by D44 — a sign-in wall at the product's front door
  // is the mistake that ruling exists to prevent. It reads the season and the
  // viewer's own row when there is one.
  '/',
  // The design tokens page, and the readiness probe `playwright.config.mts`
  // polls: it touches no repository and renders through the root layout.
  '/tokens',
  // The login and registration forms themselves. Protecting the way in is a
  // loop.
  '/auth/login/[[...login]]',
  '/auth/register/[[...register]]',
  // 🔴 Clerk posts to the webhook with no session and authenticates by svix
  // signature instead. See its route handler.
  '/api/webhooks/clerk',
  // 🔴 Public for the same reason as the webhook: it authenticates by shared
  // secret, not by session, because the caller is a script and has none. It
  // reads nothing and writes nothing — it only asks four pages to re-render.
  // See app/api/revalidate/route.ts.
  '/api/revalidate',
  // 🔴 League pages, deliberately (D44/D45). The source app never guarded
  // them, and the link people paste into a group chat has to open for whoever
  // taps it. Signing in only marks the viewer's own seat.
  '/leagues/[id]',
  // 🔴 Owner-only, and NOT left unguarded by being listed here: the page
  // resolves the session itself and answers 404 to anyone who is not an owner,
  // which is a stronger answer than a redirect, because a bounce to sign-in
  // would confirm the league exists and is mid-draft.
  '/leagues/[id]/draft',
  // Same shape: the page resolves the session and 404s a stranger.
  '/leagues/[id]/setup',
  // 🔴 Public to the proxy, and gated by the page anyway — it calls
  // `requireUser()`, because creating a league writes the caller's id into the
  // owner column. Listed here because that is what the proxy answered, not
  // because a signed-out visitor gets anything from it.
  '/leagues/new',
  // `/leagues` itself — the list of leagues *you* are in — is deliberately
  // absent. A league board is shareable; the list of your own is about you.
  //
  // Award shows, also public in the source (D44). These are the pages a member
  // opens mid-ceremony to see what a film is up for; the admin controls on
  // them are gated on the session, not on the route.
  '/award-shows',
  '/award-shows/[abbr]',
  '/award-shows/[abbr]/opengraph-image',
  // Film pages, public in the source and the app's most-shared URL. 🔴 The page
  // **never writes** (D63), and that is what makes leaving it open safe: an
  // anonymous reader, or a crawler walking every TMDB id, cannot cause a row to
  // be created. The watched badge renders only for a signed-in reader and its
  // action checks the session itself.
  '/films/[tmdbId]',
  '/films/[tmdbId]/opengraph-image',
  // Browse, public for the same reasons: it was public in the source, it is
  // where a link to a film comes from, and it only reads.
  '/browse',
  // The invite link. Public because the whole point is that someone with no
  // account can open it — the page names the league and offers to register,
  // carrying the uuid through so they land back here afterwards.
  '/join/[uuid]',
  // The page that explains the game. It reads the `points` table and the
  // season's nominations and writes nothing.
  '/how-it-works',
  // 🔴 Its share card needs its own entry — without one, a crawler building a
  // link preview for the product's front door is handed a redirect.
  '/how-it-works/opengraph-image',
  // 🔴 The live surface, public by the owner's ruling (P17.T16). A stranger
  // handed the link during a ceremony has to be able to watch — a sign-in wall
  // at the product's second peak moment is the mistake D44 exists to prevent.
  //
  // Safe for the same reason `/` is: `getLiveShow(abbr, year, null)` does not
  // query leagues rather than querying with a sentinel, so no code path
  // resolves somebody else's team for an anonymous reader, and
  // `scoring.batching.test.ts` pins that as a query-count equality.
  '/live/[abbr]',
  // 🔴 The same ruling, one door further in: the SSE stream the page's client
  // opens (P14.T3/D102). It is not covered by `/live/[abbr]` — nothing here
  // wildcards, and `/api/…` was never inside the page's entry anyway — so
  // without this line a stranger's `EventSource` is refused the moment it
  // opens and the public page they were handed simply never updates.
  //
  // It grants exactly what the page grants and is the same shape of safe: the
  // handler resolves the reader with `getCurrentUser()` and calls
  // `getLiveShow` with the page's four arguments, so a signed-out reader with
  // no `?league=` gets `league: null` and `leagueOptions: []` — no seat name
  // reaches a stranger through the stream that the page withholds. Its own
  // `route.test.ts` pins that, in both directions.
  '/api/live/[abbr]/stream',
  // 🔴 Member profiles, by the owner's ruling (P17.T37). The league page is the
  // member index — every seat on it links to `/members/<uuid>` — and league
  // pages are public, so without this every name on a shared league page
  // bounces a stranger to sign-in.
  //
  // Public is not discoverable: the page keeps `robots: index:false`,
  // `app/robots.ts` disallows `/members`, `app/sitemap.ts` omits it, and
  // `/members` itself 404s. 🔴 The page withholds the avatar from a signed-out
  // reader — 51 of 60 stored avatars are Gravatar URLs whose path is
  // `MD5(email)`. That rule lives in the page; this entry only opens the door.
  '/members/[uuid]',
  // 🔴 Crawler and scraper endpoints, useless behind a redirect: a bot asking
  // for robots.txt gets sent to a login page, and a scraper building a link
  // preview gets one for the share card. All three are generated from public
  // data only (P15.T6) — the sitemap lists nothing that is not already on this
  // list, and its own test asserts that.
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
];
