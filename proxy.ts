import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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
  '/',
  '/tokens',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
