import { clerkMiddleware } from '@clerk/nextjs/server';
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
 * 🔴 **No route protection happens here any more.** This file used to call
 * `createRouteMatcher` with a verbatim list of public routes and
 * `auth.protect()` on everything else; Clerk deprecated that helper and now
 * prescribes checking on the resource instead, because a path list can diverge
 * from how Next actually routes a request. The checks moved to the pages and
 * the route handler themselves (`requirePageUser`/`requirePageAdmin` in
 * `lib/auth.ts`), and `test/route-protection.test.ts` is what keeps the list
 * of who needs one honest.
 *
 * `clerkMiddleware()` stays, with no callback. Clerk still needs it to attach
 * the request context that `auth()` and `currentUser()` read — remove it and
 * every session resolution throws, which is the opposite of a safe failure.
 * What it no longer does is decide anything.
 */

/**
 * 🔴 The test run has no Clerk, so it cannot have `clerkMiddleware` either
 * (D84) — that helper needs a secret key, and installing it without one fails
 * every request rather than passing it through.
 *
 * This branch is keyed on `isTestAuthEnabled()` rather than on whether a Clerk
 * key happens to be present, because a key that went missing from a deployed
 * environment would then silently swap the app onto the pass-through. The flag
 * cannot be set on Vercel — lib/test-auth.ts refuses to load.
 *
 * 🔴 What the branch gives up shrank with this migration, and that is the
 * point of it. It used to mean the whole test run had no route protection at
 * all, so no browser test in this repo could ever observe a protected route
 * refusing a stranger — the old `proxy.test.ts` said so, and it was the only
 * guard on several routes because of it. Protection now lives on the resource,
 * which both branches reach identically, so `e2e/route-protection.spec.ts`
 * watches every route answer a signed-out request for real.
 *
 * `config.matcher` below is shared by both branches, so the set of paths this
 * file sees never depends on which one is active.
 */
const passThrough = () => NextResponse.next();

export default isTestAuthEnabled()
  ? passThrough
  : clerkMiddleware({
      // 🔴 Kept, though nothing here redirects any more. Any Clerk-issued
      // redirect reads these, and left unset Clerk aims at its hosted portal on
      // `*.accounts.dev` — a different origin, which is what made every RSC
      // prefetch (`?_rsc=…`, a `fetch`) die in CORS on the deployed site. The
      // value is one constant shared with `app/providers.tsx` so the server's
      // answer and the client's cannot drift. See lib/auth-routes.ts.
      signInUrl: SIGN_IN_URL,
      signUpUrl: SIGN_UP_URL,
    });

export const config = {
  matcher: [
    // Skip Next internals and static files unless they appear in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
