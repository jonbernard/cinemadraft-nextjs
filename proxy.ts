import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { SIGN_IN_URL, SIGN_UP_URL } from '@/lib/auth-routes';
import { isTestAuthEnabled } from '@/lib/test-auth';

/**
 * Next 16 renamed this file convention from `middleware` to `proxy`. Both
 * still resolve, but `middleware.ts` logs a deprecation warning and having
 * both present is a hard build error (E900) — so there is one correct name and
 * this is it. Clerk's helper is unaffected: it detects itself through a header
 * it sets at request time, not through the filename.
 *
 * Everything under the `(app)` segment requires a session. The marketing
 * pages, the auth pages and the webhook do not.
 *
 * The list enumerates PUBLIC routes rather than protected ones, deliberately.
 * A page added under `(app)` is then protected by default and forgetting to
 * list it fails closed. Enumerating protected routes instead leaks a page the
 * first time someone forgets — and the failure is silent, because the page
 * renders perfectly well to a stranger.
 *
 * The webhook must stay public: Clerk posts to it without a session, and it
 * authenticates by svix signature instead (see its route handler).
 */
const isPublic = createRouteMatcher([
  // Public by default (D44) — this list is the deliberate record of what is
  // safe to expose. Forgetting to add a page makes it protected, which is
  // visible and harmless; the reverse would leak it silently.
  '/',
  '/tokens',
  '/auth/(.*)',
  '/api/webhooks/(.*)',
  // 🔴 Public for the same reason as the webhook: it authenticates by shared
  // secret, not by session, because the caller is a script and has none. It
  // reads nothing and writes nothing — it only asks four pages to re-render.
  // See app/api/revalidate/route.ts.
  '/api/revalidate',
  // 🔴 League pages, deliberately (D44/D45). The source app never guarded
  // them, and the link people paste into a group chat has to open for whoever
  // taps it. Signing in only marks the viewer's own seat.
  //
  // This matches `/leagues/1` and everything under it — including
  // `/leagues/1/draft`, which is owner-only. That page is not left unguarded
  // by this: it resolves the session itself and answers 404 to anyone who is
  // not an owner, which is a stronger answer than the proxy's, because a
  // bounce to sign-in would confirm the league exists and is mid-draft.
  // `/leagues` itself is not matched, so the index stays private.
  '/leagues/(.*)',
  // Award shows, also public in the source (D44). These are the pages a member
  // opens mid-ceremony to see what a film is up for; the admin controls on
  // them are gated on the session, not on the route — which is what the source
  // did too, and there the *writes* were left open (`PARITY.md` bug 1). Here
  // the page is open and every write behind it requires an admin.
  '/award-shows/(.*)',
  '/award-shows',
  // Film pages, public in the source and the app's most-shared URL — a link to
  // one gets pasted into the league's chat every week, and it has to open for
  // whoever taps it. It is also the page most likely to be found by search,
  // which is why it carries Open Graph metadata.
  //
  // 🔴 The page **never writes** (D63), and that is what makes leaving it open
  // safe: an anonymous reader, or a crawler walking every TMDB id, cannot cause
  // a row to be created. The watched badge is the only control on it, it renders
  // only for a signed-in reader, and its action checks the session itself.
  '/films/(.*)',
  // Browse, public for the same reasons: it was public in the source, it is
  // where a link to a film comes from, and it only reads. The watched badge on
  // each poster renders for a signed-in reader and its action checks the session
  // itself.
  '/browse',
  // The invite link. Public because the whole point is that someone with no
  // account can open it — the page itself names the league and offers to
  // register, carrying the uuid through so they land back here afterwards.
  // Protecting it would bounce them to a login page that cannot say what they
  // were invited to.
  '/join/(.*)',
  // The page that explains the game, and the one a new reader is most likely
  // to be sent. It reads the `points` table and the season's nominations and
  // writes nothing, so there is nothing behind it to protect.
  //
  // 🔴 `/rules-and-scoring` is NOT listed any more, and does not need to be:
  // `next.config.ts` redirects it permanently, and `redirects` runs before
  // this file (next/dist/docs/01-app/02-guides/redirecting.md:293), so the
  // stale URL never reaches the proxy at all.
  '/how-it-works',
  // 🔴 The page's own share card, which needs its own entry: this list matches
  // exact paths, and `/how-it-works` is one. `/films/(.*)` and
  // `/award-shows/(.*)` cover their cards by accident of being subtrees; this
  // route is not, so without this line a crawler building a link preview for
  // the product's front door is handed a 307 to the sign-in page. Named rather
  // than widened to `/how-it-works/(.*)`, so a future page under this path is
  // still protected by default.
  //
  // 🔴 The trailing `(.*)` is not decoration. Next emits this route at
  // `/how-it-works/opengraph-image-<hash>` — the build output names it — and
  // the hash changes whenever the card's code does, so a literal path here
  // matches for exactly as long as nobody edits the card.
  '/how-it-works/opengraph-image(.*)',
  // 🔴 The live surface, public by the owner's ruling (P17.T16). A stranger
  // handed the link during a ceremony has to be able to watch — that is the
  // whole reason the route exists, and a sign-in wall at the product's second
  // peak moment is the mistake D44 exists to prevent on `/`.
  //
  // 🔴 This is a narrow amendment to D40. The mechanism is unchanged: the list
  // still enumerates PUBLIC routes, a page under `(app)` is still protected by
  // default, and forgetting one still fails closed. This is one deliberate
  // addition to the list, the same shape as the entries above it.
  //
  // Safe for the same reason `/` is: `getLiveShow(abbr, year, null)` does not
  // query leagues rather than querying with a sentinel, so there is no code
  // path on which an anonymous reader resolves somebody else's team, and
  // `scoring.batching.test.ts` pins that as a query-count equality. The page
  // never writes **for an anonymous reader** — `getCurrentUser()` can claim a
  // row (D38), but it returns before that for a request with no session, so a
  // crawler walking every abbreviation cannot cause an insert.
  //
  // 🔴 This matches the whole `/live/` subtree, not just `/live/[abbr]`, the
  // same way `/leagues/(.*)` does — so a page added under it later is public
  // by default, which inverts the rule at the top of this file. Today there is
  // exactly one route there. Anything added under `/live/` must either be safe
  // to hand a stranger or resolve the session itself and answer 404, the way
  // `/leagues/[id]/draft` does. `/api/live/...` is a different prefix and is
  // not matched by this.
  '/live/(.*)',
  // 🔴 Member profiles, by the owner's ruling (P17.T37). The league page is
  // the member index — every seat on it links to `/members/<uuid>` — and league
  // pages are public, so without this every name on a shared league page
  // bounces a stranger to sign-in.
  //
  // Public is not discoverable: the page keeps `robots: index:false`,
  // `app/robots.ts` disallows `/members`, `app/sitemap.ts` omits it, and
  // `/members` itself 404s. What a stranger can reach is one member's page,
  // from a uuid they were given.
  //
  // 🔴 The page withholds the avatar from a signed-out reader — 51 of 60
  // stored avatars are Gravatar URLs whose path is `MD5(email)`, so the `<img
  // src>` would publish a weak hash of the address. Initials instead. That
  // rule lives in the page, not here; this entry only opens the door.
  '/members/(.*)',
  // 🔴 Crawler and scraper endpoints, which are useless behind a redirect: a
  // bot asking for robots.txt or a sitemap gets a 307 to the login page, and a
  // scraper building a link preview gets one for the share card. All three are
  // generated from public data only (P15.T6) — the sitemap lists nothing that
  // is not already in this list, and its own test asserts that.
  '/robots.txt',
  '/sitemap.xml',
  '/opengraph-image',
]);

/**
 * 🔴 The test run has no Clerk, so it cannot have `clerkMiddleware` either
 * (D84) — that helper needs a secret key, and installing it without one fails
 * every request rather than passing it through.
 *
 * What is given up is route protection, and only for a run where every spec
 * drives a seeded session of its own; the pages under `(app)` still resolve
 * that session themselves, and every write still checks it. What is *not*
 * given up is the guard: this branch is keyed on `isTestAuthEnabled()` rather
 * than on whether a Clerk key happens to be present, because a key that went
 * missing from a deployed environment would then silently unprotect the whole
 * app. The flag cannot be set on Vercel — lib/test-auth.ts refuses to load.
 *
 * `config.matcher` below is shared by both branches, so the set of paths this
 * file sees never depends on which one is active.
 */
const passThrough = () => NextResponse.next();

export default isTestAuthEnabled()
  ? passThrough
  : clerkMiddleware(
      async (auth, request) => {
        if (!isPublic(request)) await auth.protect();
      },
      // 🔴 Naming the app's own pages here is what keeps the redirect same-origin.
      // Left unset, Clerk sends a logged-out visitor to its hosted portal on
      // `*.accounts.dev`, and every RSC prefetch of a protected route then follows
      // a cross-origin redirect and fails CORS. See lib/auth-routes.ts.
      { signInUrl: SIGN_IN_URL, signUpUrl: SIGN_UP_URL },
    );

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
