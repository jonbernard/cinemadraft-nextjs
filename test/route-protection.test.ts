import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { discoverRoutes, PUBLIC_ROUTES } from './route-protection';

/**
 * The fail-closed half of the boundary, after `createRouteMatcher` went away.
 *
 * Clerk deprecated middleware path matching and prescribes checking on each
 * resource instead. That advice is correct and it inverts D40's safety: a
 * matcher that enumerated the public and protected the rest failed closed,
 * while per-resource checks fail *open* — a page whose author forgot a line is
 * silently public, and it renders perfectly to a stranger, so nothing looks
 * wrong.
 *
 * This test is what puts the default back. It walks `app/` for every route
 * Next actually serves, subtracts the public list, and demands that every
 * route left carries a page gate by name in its own source. A route added
 * tomorrow is in the protected half without anybody deciding it should be, and
 * stays red until it either gets a gate or gets listed — where listing it is an
 * edit to a reviewed file with a reason written beside it.
 *
 * 🔴 What it cannot catch, stated so nobody reads it as more than it is:
 *
 *   - A gate that is present and wrong. `requirePageUser()` inside an `if`, or
 *     after the query whose result it was supposed to guard, passes here.
 *     `e2e/route-protection.spec.ts` is the answer to that one — it visits
 *     every route signed out and watches what actually comes back.
 *   - Per-row authorization. `/leagues/[id]` is public, and whether it shows
 *     you somebody else's private column is not a question about routes.
 *   - A path Next serves that is not a file under `app/` — a rewrite in
 *     `next.config.ts`, say. There are none today.
 *   - Server Actions, which are not routes. They carry their own
 *     `requireUser()`/`requireAdmin()` and always did; the proxy never
 *     protected them either.
 */

const ROOT = resolve(import.meta.dirname, '..');

/** The two gates that answer a signed-out page request. Named, not pattern-matched. */
const GATE = /\brequirePage(User|Admin)\(/;

describe('route protection', () => {
  it('lists every route a stranger may reach, and no more', () => {
    // Pinned verbatim rather than compared to itself. Without this an entry
    // added to `PUBLIC_ROUTES` would simply move a route into the half nothing
    // checks, silently — which is the failure direction that actually costs
    // something (D45). Opening a route has to be two edits in two files, and
    // this is the second one.
    expect(PUBLIC_ROUTES).toEqual([
      '/',
      '/tokens',
      '/auth/login/[[...login]]',
      '/auth/register/[[...register]]',
      '/api/webhooks/clerk',
      '/api/revalidate',
      '/leagues/[id]',
      '/leagues/[id]/draft',
      '/leagues/[id]/setup',
      '/award-shows',
      '/award-shows/[abbr]',
      '/award-shows/[abbr]/opengraph-image',
      '/films/[tmdbId]',
      '/films/[tmdbId]/opengraph-image',
      '/browse',
      '/join/[uuid]',
      '/how-it-works',
      '/how-it-works/opengraph-image',
      '/live/[abbr]',
      '/api/live/[abbr]/stream',
      '/api/leagues/[id]/board/stream',
      '/members/[uuid]',
      '/robots.txt',
      '/sitemap.xml',
      '/opengraph-image',
    ]);
  });

  it('every public route is a route that exists', () => {
    // A stale entry is not harmless: it is a line somebody reads as "this was
    // considered", and the page it referred to may have moved to a path that
    // is now quietly protected — or, worse, the entry's spelling drifted and
    // it stopped covering anything at all.
    const served = new Set(discoverRoutes().map((route) => route.path));
    expect(PUBLIC_ROUTES.filter((route) => !served.has(route))).toEqual([]);
  });

  it('every route that is not public gates itself', () => {
    const unprotected = discoverRoutes()
      .filter((route) => !PUBLIC_ROUTES.includes(route.path))
      .filter((route) => !GATE.test(readFileSync(resolve(ROOT, route.file), 'utf8')))
      .map((route) => `${route.path} (${route.file})`);

    // The message an author actually needs, on the line that fails.
    expect(
      unprotected,
      'these routes are not in PUBLIC_ROUTES and call neither requirePageUser() ' +
        'nor requirePageAdmin(), so a signed-out stranger reaches them: ',
    ).toEqual([]);
  });

  it('names the eleven routes that are protected today', () => {
    // The other direction, and the reason it is worth spelling out: the test
    // above passes vacuously if `discoverRoutes()` ever stops discovering
    // anything — a rename of `app/`, a walk that throws and is caught, a glob
    // that matches nothing. An empty protected set is not a clean bill of
    // health, it is a broken walk, so the count is pinned.
    const protectedRoutes = discoverRoutes()
      .map((route) => route.path)
      .filter((route) => !PUBLIC_ROUTES.includes(route));

    expect(protectedRoutes).toEqual([
      // Not a page anybody asked for — every URL matching nothing else. The
      // proxy protected it by default, so a typo'd URL has always shown a
      // logged-out visitor the login form rather than "not here", and the gate
      // there keeps that answer rather than changing it by omission.
      '/[...notFound]',
      '/admin',
      '/admin/broadcast',
      '/admin/relink',
      '/admin/season',
      // 🔴 Protected only because the proxy's default caught it — its own
      // docstring says it is public and always did. A calendar client sends no
      // session, so the feed has never worked for the one audience it has.
      // Kept protected here because a migration may not move a route across the
      // boundary; see the note in the route handler.
      '/api/ical/[...slug]',
      '/leagues',
      // 🔴 Added by P12.T5. It was public, with a comment conceding that it was
      // listed only because that is what the proxy answered — and the page then
      // gated itself by THROWING, which a page turns into a 500. A stranger
      // tapping "Start a league" got an error boundary, confirmed on the
      // deployed site. Creating a league writes the caller's id into the owner
      // column, so there is no version of it a signed-out visitor can use: it
      // is a protected route, and the proxy's redirect carries `?redirect_url=`
      // so they land back here once they are in.
      '/leagues/new',
      '/list',
      // 🔴 Protected because it cannot answer without a session: it resolves
      // the reader's own uuid and redirects to `/members/<uuid>`. Signed out
      // there is nothing to resolve, so the proxy's redirect is the right
      // answer and `requirePageUser` is the second line.
      '/profile',
      '/watchlist',
    ]);
  });
});
