#!/usr/bin/env node
/**
 * P12.T4 — load-test draft-day search.
 *
 * The one path that gets hammered: the owner types a title per pick, live,
 * while a dozen people watch, and the typeahead fires `findFilmsAction` on
 * every debounce.
 *
 * ## The threshold, written before the first run
 *
 * 🔴 **p95 under 400ms and zero 5xx**, for the local-only path. Both are the
 * constants below and neither was chosen after reading a number. The script
 * exits non-zero when either is missed; if it fails, the finding is that it
 * fails, not that the budget was optimistic.
 *
 * "Local-only" means `TMDB_API_KEY` unset, so `searchTmdb` adds nothing and the
 * measurement is this app's Postgres round trips rather than a third party's
 * latency. `findFilms` always asks TMDB in production — that leg is a network
 * call with its own 3s timeout and its own week-long cache, and mixing it in
 * would measure themoviedb.org.
 *
 * ## How to run it
 *
 * 🔴 Against a **local production build on an agent database**, never against
 * the deployed site: Neon Free bills awake-time, and a load test there spends
 * the very 100 CU-hr allowance Phase 12 exists to measure.
 *
 *   export DATABASE_URL=postgresql://cinemadraft:local@localhost:5441/cinemadraft
 *   TMDB_API_KEY= npm run build && TMDB_API_KEY= npm run start -- -p 6441
 *   node scripts/load-search.mjs http://localhost:6441
 *
 * It refuses any origin that is not localhost.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

// ---------------------------------------------------------------- the budget
/** p95 must be under this. Decided 2026-09-14, before the first run. */
const P95_BUDGET_MS = 400;
/** And nothing may 5xx. A search that errors mid-draft stops the draft. */
const MAX_5XX = 0;

// ----------------------------------------------------------------- the shape
const WORKERS = 4; // four owners drafting at once
const DEBOUNCE_MS = 400; // one query per worker per debounce
const DURATION_MS = 120_000; // two minutes
const SEASON = 2026;

const ORIGIN = (process.argv[2] ?? 'http://localhost:6441').replace(/\/+$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(ORIGIN)) {
  throw new Error(
    `scripts/load-search.mjs refuses ${ORIGIN}. It only points at a local production build — ` +
      'a load test against the deployed site spends the Neon Free allowance it is meant to measure.',
  );
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
if (/\.neon\.tech/.test(DATABASE_URL)) {
  throw new Error(
    'scripts/load-search.mjs refuses to point at Neon. Use an agent database.',
  );
}

/**
 * The action's id, read out of the build rather than pasted in.
 *
 * Next derives it from the file and export name and it changes whenever either
 * does, so a hardcoded hash is a script that silently posts to nothing after
 * the next refactor. `.next/server/app/**\/server-reference-manifest.json`
 * carries `exportedName`, which is the durable thing to look for.
 */
function actionId() {
  const manifests = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === 'server-reference-manifest.json') manifests.push(path);
    }
  };
  walk('.next/server/app');

  for (const path of manifests) {
    const { node = {} } = JSON.parse(readFileSync(path, 'utf8'));
    for (const [id, entry] of Object.entries(node)) {
      if (entry.exportedName === 'findFilmsAction') return id;
    }
  }
  throw new Error(
    'scripts/load-search.mjs cannot find findFilmsAction in .next/. Run `npm run build` first.',
  );
}

/**
 * 🔴 **The query count per request is NOT measured here**, and the first
 * version of this script measuring it was the reason to say so out loud. It
 * read `pg_stat_database.xact_commit` either side of the run and divided —
 * which looked right (2.79, against a true 3.00) and measures something else:
 * fifty sequential requests that issue 150 statements move that counter by
 * **2**, because a pooled connection does not commit per statement. A number
 * that plausible and that wrong is worse than none.
 *
 * The repo already owns the exact instrument: `test/query-count.ts` listens to
 * the shared Prisma client's `query` event, and
 * `lib/services/scoring.batching.test.ts` pins draft-day search as an equality
 * there — the same query count for one local match as for a full page of them.
 * That is where a regression is caught; this script measures latency and errors.
 */

/**
 * What four owners actually type, drawn from the restored data.
 *
 * A typeahead fires on prefixes, not on finished titles, so the pool is the
 * first few letters of real titles — the shape the debounce produces. Three
 * kinds of deliberate miss are mixed in, because a search that is only ever
 * measured on hits is measured on its fast path:
 *
 *   - nonsense, which the trigram index rejects outright;
 *   - a partial word, which matches broadly and returns the full 25;
 *   - a title TMDB has and this cache does not (`Shrek` — verified absent),
 *     which is the case that returns nothing at all on the local-only path.
 */
async function queryPool() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const { rows } = await client.query(
    'select title from movies where title is not null and length(title) >= 6 order by random() limit 400',
  );
  const pool = [];
  for (const { title } of rows) {
    // 3–8 characters: what is in the box when the debounce fires.
    pool.push(
      title
        .slice(0, 3 + Math.floor(Math.random() * 6))
        .trim()
        .toLowerCase(),
    );
  }
  const misses = ['zzqxwvfrb', 'qqqjjjxx', 'the', 'ing', 'shrek', 'shrek 2'];
  for (let index = 0; index < rows.length / 4; index += 1) {
    pool.push(misses[index % misses.length]);
  }

  await client.end();
  return pool;
}

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];

/** A real league's taken list, so the draft context is the size it is live. */
const TAKEN = Array.from({ length: 48 }, (_, index) => index + 1);

const ID = actionId();
const pool = await queryPool();

async function search(query) {
  const started = performance.now();
  try {
    const response = await fetch(`${ORIGIN}/leagues/1/draft`, {
      method: 'POST',
      headers: {
        'Next-Action': ID,
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: JSON.stringify([
        { query, context: { kind: 'draft', year: SEASON, takenMovieIds: TAKEN } },
      ]),
    });
    const body = await response.text();
    return {
      ms: performance.now() - started,
      status: response.status,
      // A 200 carrying `{"ok":false}` is the action having failed politely, and
      // counting it as a success would be the sweep's own mistake one layer
      // down: a measurement that cannot see the failure it exists to catch.
      ok: response.status === 200 && body.includes('"ok":true'),
    };
  } catch (error) {
    return {
      ms: performance.now() - started,
      status: 0,
      ok: false,
      error: String(error.message),
    };
  }
}

const results = [];
const deadline = Date.now() + DURATION_MS;

async function owner(seat) {
  // Stagger, so four workers do not land on the same millisecond every tick.
  await new Promise((resolve) => setTimeout(resolve, (seat * DEBOUNCE_MS) / WORKERS));
  while (Date.now() < deadline) {
    const tick = Date.now() + DEBOUNCE_MS;
    results.push(await search(pool[Math.floor(Math.random() * pool.length)]));
    const rest = tick - Date.now();
    if (rest > 0) await new Promise((resolve) => setTimeout(resolve, rest));
  }
}

process.stdout.write(
  `${WORKERS} owners, a query every ${DEBOUNCE_MS}ms for ${DURATION_MS / 1000}s, against ${ORIGIN}\n` +
    `Budget, set before the run: p95 < ${P95_BUDGET_MS}ms, 5xx <= ${MAX_5XX}\n\n`,
);

await Promise.all(Array.from({ length: WORKERS }, (_, seat) => owner(seat)));

const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
const failed = results.filter((r) => !r.ok);
const server5xx = results.filter((r) => r.status >= 500);

process.stdout.write(
  [
    `requests        ${results.length}`,
    `p50             ${percentile(sorted, 0.5).toFixed(0)}ms`,
    `p95             ${percentile(sorted, 0.95).toFixed(0)}ms`,
    `p99             ${percentile(sorted, 0.99).toFixed(0)}ms`,
    `min / max       ${sorted[0].toFixed(0)}ms / ${sorted.at(-1).toFixed(0)}ms`,
    `errors          ${failed.length}`,
    `5xx             ${server5xx.length}`,
    '',
  ].join('\n'),
);

const p95 = percentile(sorted, 0.95);
const verdict = [];
verdict.push(
  p95 < P95_BUDGET_MS
    ? `PASS  p95 ${p95.toFixed(0)}ms < ${P95_BUDGET_MS}ms`
    : `FAIL  p95 ${p95.toFixed(0)}ms >= ${P95_BUDGET_MS}ms`,
);
verdict.push(
  server5xx.length <= MAX_5XX
    ? `PASS  ${server5xx.length} 5xx <= ${MAX_5XX}`
    : `FAIL  ${server5xx.length} 5xx > ${MAX_5XX}`,
);
process.stdout.write(`${verdict.join('\n')}\n`);

if (failed.length) {
  const seen = new Map();
  for (const r of failed) seen.set(r.status, (seen.get(r.status) ?? 0) + 1);
  process.stdout.write(
    `\nnon-ok responses: ${[...seen].map(([s, n]) => `${s} ×${n}`).join(', ')}\n`,
  );
}

process.exit(verdict.every((line) => line.startsWith('PASS')) ? 0 : 1);
