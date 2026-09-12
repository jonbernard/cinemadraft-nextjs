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
}

// Importable by the test file without running anything.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`[award-import] ${error.message}`);
    process.exitCode = 1;
  });
}
