#!/usr/bin/env node
// Enter a show's nominations or winners, then clear the cache and notify.
//
//   DATABASE_URL=… TMDB_API_KEY=… node scripts/award-import.mjs <command> [args]
//
// Commands: context | apply | finish | refresh. Nothing writes without --commit.
//
// 🔴 This script bypasses the Clerk-gated server actions, so every invariant
// they enforce is enforced here instead — see
// docs/superpowers/specs/2026-09-12-award-entry-pipeline-design.md.
//
// 🔴 It never loads a .env file. Reaching production stays a conscious act,
// which is the same rule the header of .env states.

/** Category headings vary by publication; the `awards` row is the authority. */
export function normalizeCategory(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * A listing heading → the award row it names, or null.
 *
 * 🔴 Null rather than a nearest match, deliberately. A nomination filed under
 * the wrong category pays that category's points to the film, and the page
 * renders it without a hint that anything is wrong. An unmatched heading is
 * reported to the owner instead, who can add the category or skip it.
 */
export function matchCategory(heading, awards) {
  const wanted = normalizeCategory(heading);
  return awards.find((award) => normalizeCategory(award.name) === wanted) ?? null;
}

/** Every problem with a plan, as sentences. Empty means it may be applied. */
export function validatePlan(plan, awards) {
  const problems = [];
  const byId = new Map(awards.map((award) => [award.id, award]));

  if (plan.kind !== 'nominations' && plan.kind !== 'winners') {
    problems.push('kind must be "nominations" or "winners"');
  }
  if (!Number.isSafeInteger(plan.year) || plan.year <= 0) {
    problems.push('year must be a positive integer');
  }
  if (!Array.isArray(plan.sources) || plan.sources.length === 0) {
    problems.push('the plan records no source URL');
  }

  for (const category of plan.categories ?? []) {
    const award = byId.get(category.awardId);
    if (!award) {
      problems.push(`award ${category.awardId} does not belong to this event`);
      continue;
    }
    for (const nominee of category.nominees ?? []) {
      if (award.requiresNomineeName && !nominee.detailName) {
        problems.push(
          `award ${award.id} requires a nominee name: "${nominee.title}" has none`,
        );
      }
      if (!nominee.title) problems.push(`award ${award.id} has a nominee with no title`);
    }
  }

  return problems;
}

/**
 * Is this listing for the season being written?
 *
 * 🔴 The failure this exists for: "Oscars 2026" means the 2025 season, and the
 * reverse holds for other shows. Getting it backwards writes a full, plausible,
 * entirely wrong season of nominations that scores real points for real teams.
 *
 * The test is empirical rather than semantic — compare the release years of the
 * films just resolved against the release years of the films drafted in this
 * season. A season honours the previous year's films (D57), so the accepted
 * range is the span of the picks, widened by one year at each end.
 */
export function yearCheck({ nominatedYears, seasonYears }) {
  const known = nominatedYears.filter((year) => Number.isSafeInteger(year));
  if (known.length === 0 || seasonYears.length === 0) {
    return { ok: true, reason: null };
  }

  const low = Math.min(...seasonYears) - 1;
  const high = Math.max(...seasonYears) + 1;
  const outside = known.filter((year) => year < low || year > high);

  if (outside.length * 2 <= known.length) return { ok: true, reason: null };

  const counts = new Map();
  for (const year of known) counts.set(year, (counts.get(year) ?? 0) + 1);
  const shape = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => `${year}×${count}`)
    .join(', ');

  return {
    ok: false,
    reason:
      `${outside.length} of ${known.length} nominated films fall outside ` +
      `${low}–${high}, the range this season's draft picks sit in. ` +
      `Nominated: ${shape}. This is usually the wrong year's listing.`,
  };
}

import { Client } from 'pg';

/**
 * 🔴 No dotenv, on purpose. `.env` points at local Docker and `.env.neon` at
 * production; a script that picks one up silently is a script that writes to
 * whichever the author last edited.
 */
export async function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Pass it explicitly:\n' +
        '  DATABASE_URL="$(grep -m1 ^DATABASE_URL .env.neon | cut -d= -f2-)" node scripts/award-import.mjs …',
    );
  }
  if (!/\.neon\.tech/.test(connectionString)) {
    const host = connectionString.replace(/:\/\/[^@]*@/, '://…@');
    console.warn(`[award-import] NOT production — connected to ${host}`);
  }
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/**
 * Everything the skill needs before it reads a single web page.
 *
 * 🔴 `points` is joined through `points.id`. `awards.points` is a FOREIGN KEY,
 * not a point value (D41) — "Performance by an Ensemble" stores 1 and is worth
 * 5 — so printing the raw column would put a confident wrong number in front
 * of whoever is checking the plan.
 */
export async function loadContext(client, abbreviation) {
  const events = await client.query(
    'SELECT id, name, abbreviation, nom_active, awards_active FROM events WHERE lower(abbreviation) = lower($1)',
    [abbreviation],
  );
  const event = events.rows[0];
  if (!event) {
    const all = await client.query(
      'SELECT abbreviation FROM events ORDER BY abbreviation',
    );
    throw new Error(
      `no show with abbreviation "${abbreviation}". Known: ` +
        all.rows.map((row) => row.abbreviation).join(', '),
    );
  }

  const awards = await client.query(
    `SELECT a.id, a.name, coalesce(a.requires_nominee_name, false) AS requires_nominee_name,
            p.points AS points
       FROM awards a
       LEFT JOIN points p ON p.id = a.points
      WHERE a.event_id = $1
      ORDER BY a.name`,
    [event.id],
  );

  const active = await client.query(
    'SELECT year FROM available_years WHERE is_active = true LIMIT 1',
  );
  const newest = await client.query(
    'SELECT year FROM available_years ORDER BY year DESC LIMIT 1',
  );
  const activeYear = active.rows[0]?.year ?? newest.rows[0]?.year;
  if (activeYear == null) throw new Error('no seasons exist in available_years');

  const existing = await client.query(
    `SELECT n.award_id, n.movie_id, m.title
       FROM nominations n
       JOIN awards a ON a.id = n.award_id
       LEFT JOIN movies m ON m.id = n.movie_id
      WHERE a.event_id = $1 AND n.year = $2`,
    [event.id, activeYear],
  );

  // The release years of this season's drafted films — the yardstick the year
  // check measures a listing against.
  const picks = await client.query(
    `SELECT DISTINCT extract(year FROM m.release_date)::int AS year
       FROM draft_picks dp
       JOIN drafts d ON d.id = dp.draft_id
       JOIN movies m ON m.id = dp.movie_id
      WHERE d.year = $1 AND m.release_date IS NOT NULL`,
    [activeYear],
  );

  return {
    event: {
      id: event.id,
      name: event.name,
      abbreviation: event.abbreviation,
      nomActive: event.nom_active === true,
      awardsActive: event.awards_active === true,
    },
    awards: awards.rows.map((row) => ({
      id: row.id,
      name: row.name,
      requiresNomineeName: row.requires_nominee_name === true,
      points: row.points ?? 0,
    })),
    activeYear,
    existingNominations: existing.rows.map((row) => ({
      awardId: Number(row.award_id),
      movieId: Number(row.movie_id),
      title: row.title,
    })),
    seasonYears: picks.rows.map((row) => row.year).filter((year) => year != null),
  };
}

/**
 * 🔴 Pinned by test against `movieRepository.upsertByTmdbId`
 * (lib/repositories/movies.ts). This script cannot import that function —
 * lib/ is TypeScript behind `@/` aliases — so the two are copies, and the
 * column list is where they are kept honest.
 */
export function movieInsertColumns() {
  return [
    'tmdb_id',
    'imdb_id',
    'title',
    'sort_title',
    'poster',
    'backdrop',
    'release_date',
    'created_at',
    'updated_at',
  ];
}

/** TMDB detail → the shape `movies` stores. Mirrors `fetchTmdbFilm`. */
export async function fetchTmdbFilm(tmdbId) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not set; a new film cannot be ingested');

  const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
  url.searchParams.set('api_key', key);
  const response = await fetch(url);
  if (!response.ok) return null;
  const detail = await response.json();
  if (typeof detail?.id !== 'number' || typeof detail?.title !== 'string') return null;

  return {
    tmdbId: String(detail.id),
    // The stored id drops the tt prefix — every restored row is stored that
    // way, and a new row keeping it would be the only one that did.
    imdbId: detail.imdb_id ? detail.imdb_id.replace(/^tt/, '') : null,
    title: detail.title,
    // Alphabetical ordering reads this; without the strip, "The Brutalist"
    // files under T.
    sortTitle: detail.title.replace(/^(the|a)\s/i, ''),
    poster: detail.poster_path ?? null,
    backdrop: detail.backdrop_path ?? null,
    releaseDate: detail.release_date ? new Date(detail.release_date) : null,
  };
}

/** A local `movies.id` for a nominee, ingesting from TMDB the first time. */
export async function resolveFilm(client, nominee, fetchFilm = fetchTmdbFilm) {
  const found = await client.query(
    'SELECT id, title, release_date FROM movies WHERE tmdb_id = $1 LIMIT 1',
    [nominee.tmdbId],
  );
  const existing = found.rows[0];
  if (existing) {
    return {
      movieId: Number(existing.id),
      title: existing.title,
      releaseYear: existing.release_date
        ? new Date(existing.release_date).getFullYear()
        : null,
      created: false,
    };
  }

  const detail = await fetchFilm(nominee.tmdbId);
  if (!detail) {
    throw new Error(
      `TMDB has no film ${nominee.tmdbId} ("${nominee.title}") — refusing rather than writing a half-film`,
    );
  }

  const now = new Date();
  const columns = movieInsertColumns();
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const inserted = await client.query(
    `INSERT INTO movies (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id, title, release_date`,
    [
      detail.tmdbId,
      detail.imdbId,
      detail.title,
      detail.sortTitle,
      detail.poster,
      detail.backdrop,
      detail.releaseDate,
      now,
      now,
    ],
  );
  const row = inserted.rows[0];
  return {
    movieId: Number(row.id),
    title: row.title,
    releaseYear: row.release_date ? new Date(row.release_date).getFullYear() : null,
    created: true,
  };
}

/**
 * Resolve every nominee, check the season, then write — or just report.
 *
 * The order is deliberate: everything that can refuse the run does so before
 * `BEGIN`, so a refusal never leaves a half-entered category behind.
 */
export async function applyNominations(client, plan, context, { commit }) {
  const problems = validatePlan(plan, context.awards);
  if (problems.length > 0) {
    throw new Error(`this plan cannot be applied:\n  - ${problems.join('\n  - ')}`);
  }

  const resolved = [];
  for (const category of plan.categories) {
    for (const nominee of category.nominees) {
      const film = await resolveFilm(client, nominee);
      resolved.push({ category, nominee, film });
    }
  }

  const check = yearCheck({
    nominatedYears: resolved.map((entry) => entry.film.releaseYear),
    seasonYears: context.seasonYears,
  });
  if (!check.ok) throw new Error(check.reason);

  const already = new Set(
    context.existingNominations.map((row) => `${row.awardId}:${row.movieId}`),
  );
  const report = { inserted: [], skipped: [], created: [] };

  for (const { category, nominee, film } of resolved) {
    if (film.created) report.created.push(film.title);
    if (already.has(`${category.awardId}:${film.movieId}`)) {
      report.skipped.push({
        awardId: category.awardId,
        title: film.title,
        reason: 'already nominated in this category for this season',
      });
      continue;
    }
    already.add(`${category.awardId}:${film.movieId}`);
    report.inserted.push({
      awardId: category.awardId,
      awardName: category.awardName,
      title: film.title,
      movieId: film.movieId,
      detailName: nominee.detailName ?? null,
      detailCharacter: nominee.detailCharacter ?? null,
    });
  }

  if (!commit) return report;

  await client.query('BEGIN');
  try {
    const now = new Date();
    for (const row of report.inserted) {
      await client.query(
        `INSERT INTO nominations
           (movie_id, award_id, year, detail_name, detail_character, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [row.movieId, row.awardId, plan.year, row.detailName, row.detailCharacter, now],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return report;
}

/**
 * Declare winners. Mirrors `winnerRepository.setForAward` and the refusal in
 * `actions/awards/set-winner.ts`: the winner must already be nominated, and
 * setting replaces rather than adds.
 *
 * No year check here — the nominations it resolves against were already
 * checked when they were written, and requiring it again would block a live
 * ceremony over a film whose TMDB release date is a festival premiere.
 */
export async function applyWinners(client, plan, context, { commit }) {
  const problems = validatePlan(plan, context.awards);
  if (problems.length > 0) {
    throw new Error(`this plan cannot be applied:\n  - ${problems.join('\n  - ')}`);
  }

  const pending = [];
  for (const category of plan.categories) {
    for (const nominee of category.nominees) {
      const film = await resolveFilm(client, nominee);
      const nomination = await client.query(
        'SELECT id FROM nominations WHERE award_id = $1 AND movie_id = $2 AND year = $3 LIMIT 1',
        [category.awardId, film.movieId, plan.year],
      );
      const row = nomination.rows[0];
      if (!row) {
        throw new Error(
          `"${film.title}" is not nominated for ${category.awardName} in ${plan.year} — ` +
            'enter the nomination first, or fix the title',
        );
      }
      pending.push({ category, film, nominationId: Number(row.id) });
    }
  }

  const report = {
    set: pending.map((entry) => ({
      awardId: entry.category.awardId,
      awardName: entry.category.awardName,
      title: entry.film.title,
    })),
    skipped: [],
  };
  if (!commit) return report;

  await client.query('BEGIN');
  try {
    const now = new Date();
    for (const entry of pending) {
      await client.query('DELETE FROM winners WHERE award_id = $1 AND year = $2', [
        entry.category.awardId,
        plan.year,
      ]);
      await client.query(
        `INSERT INTO winners (movie_id, award_id, nomination_id, year, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $5)`,
        [entry.film.movieId, entry.category.awardId, entry.nominationId, plan.year, now],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return report;
}

import { pathToFileURL } from 'node:url';

const COMMANDS = ['context', 'apply', 'finish', 'refresh'];

async function main(argv) {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command)) {
    console.error(`usage: node scripts/award-import.mjs <${COMMANDS.join('|')}> [args]`);
    process.exitCode = 1;
    return;
  }

  if (command === 'context') {
    const client = await connect();
    try {
      console.log(JSON.stringify(await loadContext(client, rest[0]), null, 2));
    } finally {
      await client.end();
    }
  }

  if (command === 'apply') {
    // 🔴 Handles both plan.kind values: nominations (new entries) and winners (replaces).
    const planPath = rest.find((arg) => !arg.startsWith('--'));
    const commit = rest.includes('--commit');
    const { readFileSync } = await import('node:fs');
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));

    const client = await connect();
    try {
      const context = await loadContext(client, plan.eventAbbreviation);
      if (plan.year !== context.activeYear) {
        console.warn(
          `[award-import] plan year ${plan.year} is not the active season ${context.activeYear}`,
        );
      }
      const report =
        plan.kind === 'winners'
          ? await applyWinners(client, plan, context, { commit })
          : await applyNominations(client, plan, context, { commit });
      const wrote = report.inserted ?? report.set;

      console.log(commit ? 'WROTE:' : 'DRY RUN — nothing written:');
      for (const row of wrote) console.log(`  + ${row.awardName}: ${row.title}`);
      const created = report.created ?? [];
      for (const row of report.skipped) console.log(`  = ${row.title} (${row.reason})`);
      if (created.length > 0) {
        console.log(`  films newly cached from TMDB: ${created.join(', ')}`);
      }
      for (const heading of plan.unmatched ?? [])
        console.log(`  ! unmatched: ${heading}`);
      console.log(
        `${wrote.length} to insert, ${report.skipped.length} skipped` +
          (commit ? '' : ' — re-run with --commit to write'),
      );
    } finally {
      await client.end();
    }
  }
}

// Importable by the test file without running anything.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[award-import] ${error.message}`);
    process.exitCode = 1;
  });
}
