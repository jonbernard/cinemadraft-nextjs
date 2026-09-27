#!/usr/bin/env node
/**
 * P12.T2 — the capability sweep.
 *
 * Every PUBLIC route, asked for by a stranger, against a deployed origin:
 * the status it should answer, the page's own `<h1>`, no error-boundary text,
 * and the TTFB (which P12.T3 reads).
 *
 *   node scripts/sweep-deployed.mjs                      # next.cinemadraft.com
 *   node scripts/sweep-deployed.mjs http://localhost:6441 # a local prod build
 *
 * Exits non-zero if any route is red.
 *
 * 🔴 **Signed out, GET only.** No cookie, no `E2E_TEST_AUTH`, no method that
 * writes. The signed-in half of PARITY.md is the owner's judgement and does
 * not belong in a script that points at production.
 *
 * 🔴 The route list is NOT typed out here. It is `discoverRoutes()` ∩
 * `PUBLIC_ROUTES` from `test/route-protection.ts` — the same module
 * `test/route-protection.test.ts` and `e2e/route-protection.spec.ts` import —
 * so a route added tomorrow is swept without anybody editing this file, and a
 * route added tomorrow that this file cannot build a URL for throws.
 *
 * (The plan also names `e2e/inventory.spec.ts` as a source. It is not one: its
 * `ROUTES` is four paths, not exported, inside a Playwright spec that cannot be
 * imported from plain Node — and all four are already in `PUBLIC_ROUTES`.)
 */
import { discoverRoutes, PUBLIC_ROUTES } from '../test/route-protection.ts';

const ORIGIN = (process.argv[2] ?? 'https://next.cinemadraft.com').replace(/\/+$/, '');
const TIMEOUT_MS = 30_000;

/**
 * Ids that exist in the restored production copy, so a dynamic route renders a
 * real page instead of its empty state. Read out of the agent database rather
 * than invented: league 1 (`Racso award`, 16 seats), `oscars`, tmdb 313369
 * (`La La Land`, the id `e2e/inventory.spec.ts` already uses), league 1's own
 * uuid for the invite link, and a real drafter's uuid for the member page.
 */
const FIXTURES = {
  league: '1',
  abbr: 'oscars',
  tmdbId: '313369',
  leagueUuid: 'fd2b3a70-810c-4b09-802c-ea05999ae2a6',
  memberUuid: 'b33be120-a6b9-41e0-93e2-5929eb63ede3',
};

/**
 * What a route is expected to answer, where it is not "200, HTML, with an
 * `<h1>`". Every entry states *why*, and every reason comes from the route's
 * own source — not from what production happened to return when this was
 * written, which would make the sweep a photograph of the bug it exists to
 * find.
 *
 * 🔴 `url` is required for every dynamic route and the sweep throws without
 * one, so a new `/teams/[teamId]` fails loudly rather than being skipped.
 */
const EXPECT = {
  // Optional catch-alls: the real URL is the path without the segment.
  '/auth/login/[[...login]]': {
    url: '/auth/login',
    h1: false,
    why: 'Clerk renders the form; the heading is inside its component, not ours',
  },
  '/auth/register/[[...register]]': { url: '/auth/register', h1: false, why: 'as above' },

  '/leagues/[id]': { url: `/leagues/${FIXTURES.league}` },
  // Both resolve the session themselves and `notFound()` a non-owner — a
  // stronger answer than a redirect, which would confirm the league exists.
  '/leagues/[id]/draft': {
    url: `/leagues/${FIXTURES.league}/draft`,
    status: 404,
    h1: false,
    why: 'owner-only, answers 404 to a stranger by design',
  },
  '/leagues/[id]/setup': {
    url: `/leagues/${FIXTURES.league}/setup`,
    status: 404,
    h1: false,
    why: 'owner-only, answers 404 to a stranger by design',
  },
  '/award-shows/[abbr]': { url: `/award-shows/${FIXTURES.abbr}` },
  '/live/[abbr]': { url: `/live/${FIXTURES.abbr}` },
  '/films/[tmdbId]': { url: `/films/${FIXTURES.tmdbId}` },
  '/join/[uuid]': { url: `/join/${FIXTURES.leagueUuid}` },
  '/members/[uuid]': { url: `/members/${FIXTURES.memberUuid}` },

  // 🔴 The layering fixture and `playwright.config.mts`'s readiness probe, not
  // a page anybody reads: it renders two buttons to prove the cascade order.
  // No heading to look for. `e2e/smoke.spec.ts` is what guards its content.
  '/tokens': {
    h1: false,
    why: 'the cascade-layer fixture — two buttons, no prose, no heading',
  },

  // Not HTML: no `<h1>` to look for, only a status and a body that is not an
  // error page.
  '/opengraph-image': { h1: false, why: 'a PNG' },
  '/robots.txt': { h1: false, why: 'plain text' },
  '/sitemap.xml': { h1: false, why: 'XML' },

  // POST-only handlers. A GET is answered 405 by Next because the file exports
  // no GET — which is the endpoint being reachable and refusing, correctly.
  '/api/revalidate': {
    status: 405,
    h1: false,
    why: 'POST-only, authenticated by shared secret',
  },
  '/api/webhooks/clerk': {
    status: 405,
    h1: false,
    why: 'POST-only, authenticated by svix signature',
  },

  // SSE, and 🔴 both answer **204 when there is nothing to stream** — the show
  // is off air, the draft is not running — because `EventSource` retries a
  // closed 200 for ever and stops only on a non-200 (D110), and a forgotten tab
  // reconnecting is what eats the 100 CU-hr allowance. So either is the
  // endpoint working; anything else (a bounce to sign-in, a 404, a 500) is not.
  // The response never ends when it is 200, so the sweep takes the headers and
  // hangs up.
  '/api/live/[abbr]/stream': {
    url: `/api/live/${FIXTURES.abbr}/stream`,
    status: [200, 204],
    stream: true,
    h1: false,
    why: '200 while a show is on air, 204 otherwise',
  },
  '/api/leagues/[id]/board/stream': {
    url: `/api/leagues/${FIXTURES.league}/board/stream`,
    status: [200, 204],
    stream: true,
    h1: false,
    why: '200 while a draft is running, 204 otherwise',
  },
};

/**
 * The three routes this sweep cannot ask for, and the whole reason it cannot —
 * the same list, for the same reason, as `e2e/route-protection.spec.ts`'s
 * `NOT_REQUESTABLE`. Next serves a *nested* metadata route at
 * `<dir>/opengraph-image-<hash>`, and the hash changes whenever the card's code
 * does, so there is no stable URL to ask for. The unhashed path matches no
 * route and is redirected, correctly — pinning that 307 would be an assertion
 * about the catch-all, not about the card.
 *
 * (The root card, `/opengraph-image`, is not hashed and is swept like anything
 * else.) Listed by name so a fourth entry is a decision somebody makes.
 */
const NOT_SWEEPABLE = new Set([
  '/award-shows/[abbr]/opengraph-image',
  '/films/[tmdbId]/opengraph-image',
  '/how-it-works/opengraph-image',
]);

/** Text that means a boundary rendered instead of the page. */
const BOUNDARY = ['Application error', 'That did not work'];

function urlFor(route) {
  const expect = EXPECT[route];
  if (expect?.url) return expect.url;
  if (route.includes('[')) {
    throw new Error(
      `scripts/sweep-deployed.mjs has no URL for the dynamic route ${route}. ` +
        'Add one to EXPECT (with a real id, read from the database) so it is actually swept.',
    );
  }
  return route;
}

async function probe(route) {
  const expect = EXPECT[route] ?? {};
  const url = urlFor(route);
  const wantStatus = [expect.status ?? 200].flat();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(ORIGIN + url, {
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'cinemadraft-sweep/1 (P12.T2)' },
    });
    // TTFB proper: the headers are in, the body may not be.
    const ttfb = Math.round(performance.now() - started);
    const failures = [];
    if (!wantStatus.includes(response.status)) {
      failures.push(`status ${response.status}, wanted ${wantStatus.join(' or ')}`);
    }

    let h1 = '';
    if (expect.stream) {
      controller.abort();
    } else {
      const body = await response.text();
      for (const text of BOUNDARY) {
        if (body.includes(text)) failures.push(`error boundary: "${text}"`);
      }
      if (expect.h1 !== false) {
        // The shell renders no `<h1>`, so one present is the page's own. Its
        // text goes in the table: an empty or wrong heading is visible there
        // rather than being swallowed by a boolean.
        h1 = (body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!h1) failures.push('no <h1>');
      }
    }
    return { route, url, status: String(response.status), ttfb, h1, failures };
  } catch (error) {
    return {
      route,
      url,
      status: '—',
      ttfb: Math.round(performance.now() - started),
      h1: '',
      failures: [
        error.name === 'AbortError'
          ? `no response in ${TIMEOUT_MS}ms`
          : String(error.message ?? error),
      ],
    };
  } finally {
    clearTimeout(timer);
  }
}

const publicRoutes = discoverRoutes()
  .map((route) => route.path)
  .filter((route) => PUBLIC_ROUTES.includes(route));

// The exemption may only ever cover routes that exist and are public, or it is
// quietly excusing a route that has since been renamed into the swept set.
for (const route of NOT_SWEEPABLE) {
  if (!publicRoutes.includes(route)) {
    throw new Error(
      `scripts/sweep-deployed.mjs exempts ${route}, which is not a public route.`,
    );
  }
}
const routes = publicRoutes.filter((route) => !NOT_SWEEPABLE.has(route));

process.stdout.write(
  `Sweeping ${routes.length} of ${publicRoutes.length} public routes against ${ORIGIN}\n` +
    `(${NOT_SWEEPABLE.size} nested opengraph-image routes have no stable URL — see NOT_SWEEPABLE)\n\n`,
);

// Serial on purpose: the TTFB column is the measurement P12.T3 reads, and four
// concurrent requests to a scale-to-zero database measure the queue, not the
// route.
const results = [];
for (const route of routes) results.push(await probe(route));

const width = (pick) => Math.max(...results.map((r) => pick(r).length));
const urlWidth = width((r) => r.url);
const h1Width = Math.min(
  width((r) => r.h1),
  40,
);

for (const result of results) {
  const mark = result.failures.length === 0 ? 'ok  ' : 'RED ';
  process.stdout.write(
    `${mark}${result.url.padEnd(urlWidth)}  ${result.status.padStart(3)}  ${String(result.ttfb).padStart(5)}ms  ${result.h1.slice(0, h1Width).padEnd(h1Width)}` +
      (result.failures.length ? `  ← ${result.failures.join('; ')}` : '') +
      '\n',
  );
}

const red = results.filter((r) => r.failures.length > 0);
const times = results.map((r) => r.ttfb).sort((a, b) => a - b);
process.stdout.write(
  `\n${results.length - red.length}/${results.length} green. ` +
    `TTFB median ${times[Math.floor(times.length / 2)]}ms, max ${times.at(-1)}ms.\n`,
);
if (red.length) {
  process.stdout.write(`\n${red.length} RED:\n`);
  for (const r of red) process.stdout.write(`  ${r.url}: ${r.failures.join('; ')}\n`);
}
process.exit(red.length === 0 ? 0 : 1);
