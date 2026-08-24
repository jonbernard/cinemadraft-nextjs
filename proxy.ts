import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

import { SIGN_IN_URL, SIGN_UP_URL } from '@/lib/auth-routes';

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
]);

export default clerkMiddleware(
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
