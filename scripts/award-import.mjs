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

  const seenAwardIds = new Set();
  for (const category of plan.categories ?? []) {
    const award = byId.get(category.awardId);
    if (!award) {
      problems.push(`award ${category.awardId} does not belong to this event`);
      continue;
    }
    if (seenAwardIds.has(category.awardId)) {
      problems.push(`award ${category.awardId} appears twice in this plan`);
    }
    seenAwardIds.add(category.awardId);
    for (const nominee of category.nominees ?? []) {
      if (award.requiresNomineeName && !nominee.detailName?.trim()) {
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

/** A nominee's person, as the duplicate rule compares it. */
const folded = (name) => (name ?? '').trim().toLowerCase();

/**
 * Do two nominations name the same person? `detail_id` when both carry one,
 * otherwise the name, case-folded and trimmed. Two with no person at all are
 * the same (absent) person — Best Picture cannot hold one film twice.
 */
export function samePerson(a, b) {
  if (a.detailId != null && b.detailId != null) {
    return String(a.detailId) === String(b.detailId);
  }
  return folded(a.detailName) === folded(b.detailName);
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
    `SELECT n.award_id, n.movie_id, n.detail_name, n.detail_id, m.title
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
      detailName: row.detail_name,
      detailId: row.detail_id == null ? null : Number(row.detail_id),
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

/**
 * The US theatrical release date, falling back to the top-level date TMDB
 * defaults to. Mirrors `releaseDateOf` in lib/external/tmdb.ts — for an
 * awards film these two dates differ by a year routinely (a festival
 * premiere abroad against a January US release), and `applyWinners`'s own
 * docstring cites exactly that hazard.
 */
function releaseDateOf(detail) {
  const us = detail.release_dates?.results?.find((entry) => entry.iso_3166_1 === 'US');
  const raw = us?.release_dates?.[0]?.release_date ?? detail.release_date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** TMDB detail → the shape `movies` stores. Mirrors `fetchTmdbFilm`. */
export async function fetchTmdbFilm(tmdbId) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY is not set; a new film cannot be ingested');

  const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('append_to_response', 'release_dates');
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
    releaseDate: releaseDateOf(detail),
  };
}

/**
 * A local `movies.id` for a nominee, ingesting from TMDB the first time.
 *
 * 🔴 `commit: false` never inserts, even for a film not yet cached — every
 * subcommand is read-only without `--commit`. The caller gets `movieId: null`
 * and must treat that as "unverifiable", not "resolved".
 */
export async function resolveFilm(
  client,
  nominee,
  fetchFilm = fetchTmdbFilm,
  commit = true,
) {
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

  if (!commit) {
    return { movieId: null, title: nominee.title, releaseYear: null, created: true };
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
    // `tmdb_id` is unique (D132). A film ingested between the look-up above and
    // this write (the app, during a live ceremony) is returned, not doubled:
    // the no-op SET is what makes RETURNING yield the existing row.
    `INSERT INTO movies (${columns.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (tmdb_id) DO UPDATE SET tmdb_id = EXCLUDED.tmdb_id
     RETURNING id, title, release_date`,
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

  // 🔴 The year column is the season, and the season is whatever
  // available_years says. A plan naming a different one passes every other
  // check — its films are real, its categories are real — and writes a whole
  // wrong season. It also loads its idempotence skip set for `activeYear`
  // while inserting `plan.year`, so the skip matches nothing and a second run
  // doubles every film's points.
  if (plan.year !== context.activeYear) {
    throw new Error(
      `plan year ${plan.year} is not the active season ${context.activeYear} — ` +
        'fix the plan, or change the active season first',
    );
  }

  const resolved = [];
  for (const category of plan.categories) {
    for (const nominee of category.nominees) {
      const film = await resolveFilm(client, nominee, undefined, commit);
      resolved.push({ category, nominee, film });
    }
  }

  // Before a season's drafts there are no picks to measure against — and that
  // is precisely when the wrong-year listing is easiest to reach for. The
  // season and the year before it is what a season honours (D57), so it is a
  // yardstick even with nothing drafted yet.
  const yardstick =
    context.seasonYears.length > 0
      ? context.seasonYears
      : [context.activeYear - 1, context.activeYear];

  const check = yearCheck({
    nominatedYears: resolved.map((entry) => entry.film.releaseYear),
    seasonYears: yardstick,
  });
  if (!check.ok) throw new Error(check.reason);

  // 🔴 One film may hold two nominations in a category — 2026 Supporting
  // Actor had One Battle After Another for Benicio del Toro and Sean Penn. A
  // duplicate is the same film AND the same person. Every row here is
  // `activeYear`, which is `plan.year`, so the year needs no comparing.
  const already = context.existingNominations.map((row) => ({
    awardId: row.awardId,
    filmKey: row.movieId,
    detailName: row.detailName,
    detailId: row.detailId,
  }));
  const report = { inserted: [], skipped: [], created: [] };

  for (const { category, nominee, film } of resolved) {
    if (film.created) report.created.push(film.title);
    // 🔴 A dry run has no movie id for an uncached film, and without this
    // fallback every uncached nominee in a category collides into one key and
    // the report hides all but the first from approval.
    const filmKey = film.movieId ?? `tmdb:${nominee.tmdbId}`;
    const entry = {
      awardId: category.awardId,
      filmKey,
      detailName: nominee.detailName ?? null,
      detailId: nominee.detailId ?? null,
    };
    const duplicate = already.some(
      (row) =>
        row.awardId === entry.awardId &&
        row.filmKey === entry.filmKey &&
        samePerson(row, entry),
    );
    if (duplicate) {
      report.skipped.push({
        awardId: category.awardId,
        title: film.title,
        detailName: entry.detailName,
        reason: 'already nominated in this category for this season',
      });
      continue;
    }
    already.push(entry);
    report.inserted.push({
      awardId: category.awardId,
      awardName: category.awardName,
      title: film.title,
      movieId: film.movieId,
      detailName: nominee.detailName ?? null,
      detailCharacter: nominee.detailCharacter ?? null,
      detailId: nominee.detailId ?? null,
    });
  }

  if (!commit) return report;

  await client.query('BEGIN');
  try {
    const now = new Date();
    for (const row of report.inserted) {
      await client.query(
        `INSERT INTO nominations
           (movie_id, award_id, year, detail_name, detail_character, detail_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
        [
          row.movieId,
          row.awardId,
          plan.year,
          row.detailName,
          row.detailCharacter,
          row.detailId,
          now,
        ],
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
 * 🔴 The nomination is resolved by film AND person. One film can hold two
 * nominations in a category, the app crowns whoever `winners.nomination_id`
 * points at, and a lookup by film alone would pick one arbitrarily. With no
 * person named and more than one candidate, this refuses — it never guesses.
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

  // Same guard as applyNominations. The nomination lookup below already
  // filters on `plan.year`, so a mismatch refuses in practice — but the two
  // should not disagree about what is legal.
  if (plan.year !== context.activeYear) {
    throw new Error(
      `plan year ${plan.year} is not the active season ${context.activeYear} — ` +
        'fix the plan, or change the active season first',
    );
  }

  const pending = [];
  const unverifiable = [];
  for (const category of plan.categories) {
    for (const nominee of category.nominees) {
      const film = await resolveFilm(client, nominee, undefined, commit);
      if (film.movieId == null) {
        // Dry run, film not yet cached — there is nothing to look up a
        // nomination against. Reporting "not nominated" here would be a lie.
        unverifiable.push({
          awardId: category.awardId,
          awardName: category.awardName,
          title: film.title,
        });
        continue;
      }
      const nominations = await client.query(
        `SELECT id, detail_name, detail_id FROM nominations
          WHERE award_id = $1 AND movie_id = $2 AND year = $3
          ORDER BY id`,
        [category.awardId, film.movieId, plan.year],
      );
      const rows = nominations.rows.map((row) => ({
        id: Number(row.id),
        detailName: row.detail_name,
        detailId: row.detail_id,
      }));
      const person = { detailName: nominee.detailName, detailId: nominee.detailId };
      const named = folded(person.detailName) !== '' || person.detailId != null;
      const candidates = named ? rows.filter((row) => samePerson(row, person)) : rows;
      const who = named ? ` for ${person.detailName ?? `person ${person.detailId}`}` : '';

      if (candidates.length === 0) {
        throw new Error(
          `"${film.title}" is not nominated${who} for ${category.awardName} in ${plan.year} — ` +
            'enter the nomination first, or fix the title' +
            (rows.length > 0
              ? `. Its nominations here: ${rows.map((row) => row.detailName ?? '(no name)').join(', ')}`
              : ''),
        );
      }
      if (candidates.length > 1) {
        throw new Error(
          `"${film.title}" has ${candidates.length} nominations${who} for ${category.awardName} ` +
            `in ${plan.year}: ${candidates
              .map((row) => `${row.detailName ?? '(no name)'} [#${row.id}]`)
              .join(', ')} — name the winner with detailName; refusing to guess`,
        );
      }
      pending.push({
        category,
        film,
        nominationId: candidates[0].id,
        detailName: candidates[0].detailName ?? null,
      });
    }
  }

  const report = {
    set: pending.map((entry) => ({
      awardId: entry.category.awardId,
      awardName: entry.category.awardName,
      title: entry.film.title,
      detailName: entry.detailName,
    })),
    skipped: [],
    unverifiable,
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

/**
 * Mark the show entered and tell everyone.
 *
 * 🔴 `nom_active = true` means "this show still needs nominations" — see
 * `needsNominations` in lib/services/award-show.ts. Finishing clears it.
 *
 * 🔴 Irreversible. The app has no notification deletion (R8), so this is the
 * one command whose effect cannot be corrected by re-running it.
 */
export async function finishShow(client, context, { message, kind, commit }) {
  const text = (message ?? '').trim();
  if (text === '') throw new Error('a broadcast needs a message');

  const column = kind === 'winners' ? 'awards_active' : 'nom_active';
  const counted = await client.query('SELECT count(*)::int AS count FROM users');
  const recipients = Number(counted.rows[0]?.count ?? 0);

  if (!commit) return { recipients, flag: column };

  const link = `/award-shows/${context.event.abbreviation}`;
  await client.query('BEGIN');
  try {
    await client.query(
      `UPDATE events SET ${column} = false, updated_at = now() WHERE id = $1`,
      [context.event.id],
    );
    // One statement for every recipient, matching notificationRepository.broadcast
    // — which shares a single createdAt across the whole broadcast on purpose.
    await client.query(
      `INSERT INTO notifications (user_id, message, icon, link, read, created_at, updated_at)
       SELECT id, $1, NULL, $2, false, now(), now() FROM users`,
      [text, link],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return { recipients, flag: column };
}

/**
 * Clear the cache, then prove it.
 *
 * 🔴 This is the "regenerate the scores" step, and it is a cache clear rather
 * than a recompute because there is nothing to recompute: scoring is a pure
 * function applied on read (D59), so a nomination is live the moment it
 * commits. What goes stale is the render — every award write through the app
 * ends in `revalidatePath`, and this script makes none of those calls.
 *
 * Step two is what makes step one honest: a 200 from the endpoint proves
 * nothing about what a reader sees.
 *
 * 🔴 If materialized totals ever return, the recompute call goes HERE and in
 * the route this posts to — nowhere else. Every command routes through it.
 */
export async function refresh({
  abbreviation,
  year,
  titles,
  baseUrl,
  secret,
  fetchImpl = fetch,
}) {
  if (!secret) {
    throw new Error(
      'REVALIDATE_SECRET is not set — refusing to skip the cache clear silently',
    );
  }

  const posted = await fetchImpl(`${baseUrl}/api/revalidate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, abbreviation }),
  });
  if (!posted.ok) {
    throw new Error(
      `/api/revalidate answered ${posted.status} — the cache was not cleared`,
    );
  }
  const { revalidated } = await posted.json();

  const page = await fetchImpl(`${baseUrl}/award-shows/${abbreviation}?year=${year}`);
  const html = await page.text();
  const missing = titles.filter((title) => !html.includes(title));

  return { revalidated, missing };
}

const ET = 'America/New_York';
const HOUR = 3600000;
const DAY = 86400000;

/**
 * A zone's offset from UTC at a given instant, in milliseconds, positive east.
 *
 * 🔴 Derived from `Intl`, not from a table. The alternative — assuming ET is
 * UTC−5 — is wrong for every ceremony held after US daylight saving begins in
 * March, which is the Oscars every year.
 *
 * `formatToParts` with `timeZone` gives the wall-clock reading in that zone;
 * re-reading it as if it were UTC and subtracting gives the offset.
 */
export function zoneOffsetMs(instantMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));

  const at = (type) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour'),
    at('minute'),
    at('second'),
  );
  return asUtc - instantMs;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * A wall-clock time in a zone → the epoch instant it names.
 *
 * Two passes, not one: the offset depends on the instant, and the instant is
 * what is being solved for. The first pass uses the offset at the naive
 * reading; the second corrects it if that reading fell on the far side of a
 * daylight-saving transition.
 */
export function toInstant({ date, time, tz = ET }) {
  if (!DATE_PATTERN.test(date ?? '')) {
    throw new Error(`date must be YYYY-MM-DD, got "${date}"`);
  }
  if (!TIME_PATTERN.test(time ?? '')) {
    throw new Error(`time must be HH:MM, got "${time}"`);
  }

  const naive = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(naive))
    throw new Error(`date "${date}" and time "${time}" are not real`);

  const first = naive - zoneOffsetMs(naive, tz);
  return naive - zoneOffsetMs(first, tz);
}

/**
 * The two columns `events` actually stores.
 *
 * 🔴 `date` is UTC midnight of the event's **local** calendar day, and `time`
 * is everything else — which for an evening ceremony is more than 24 hours.
 * An 8pm ET ceremony on 11 January is 01:00Z on the 12th; storing the 12th
 * would move it a day in the calendar feed and on the show page. Every
 * restored row follows this, and the round-trip tests pin all twelve.
 */
export function toDateTimeSplit({ date, time, tz = ET }) {
  const instant = toInstant({ date, time, tz });
  const midnight = Date.parse(`${date}T00:00:00Z`);
  return { date: midnight, time: instant - midnight };
}

/**
 * When a season's dates live: 1 August of the prior year to 31 July.
 *
 * The 2026 season really runs from AFI's nominations on 4 December 2025 to the
 * Oscars on 15 March 2026, so this has months of margin at both ends and
 * cannot be confused with an adjacent season.
 */
export function seasonWindow(year) {
  return {
    start: Date.parse(`${year - 1}-08-01T00:00:00Z`),
    end: Date.parse(`${year}-07-31T23:59:59.999Z`),
  };
}

/** Is this instant part of that season? A null never is. */
export function isInSeason(instantMs, year) {
  if (instantMs == null) return false;
  const { start, end } = seasonWindow(year);
  return instantMs >= start && instantMs <= end;
}

/** An instant as a person reads it, for the report. */
export function formatEt(instantMs) {
  if (instantMs == null) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(instantMs));
}

/**
 * Every show's schedule, and whether each half is already current.
 *
 * 🔴 Nominations and ceremony are judged separately. A show routinely
 * announces its nominations date months before its ceremony date, so treating
 * the show as one unit would either re-research what is already known or skip
 * what is still missing.
 */
export async function loadDates(client) {
  const active = await client.query(
    'SELECT year FROM available_years WHERE is_active = true LIMIT 1',
  );
  const newest = await client.query(
    'SELECT year FROM available_years ORDER BY year DESC LIMIT 1',
  );
  const activeYear = active.rows[0]?.year ?? newest.rows[0]?.year;
  if (activeYear == null) throw new Error('no seasons exist in available_years');

  const rows = await client.query(
    `SELECT id, abbreviation, name, has_ceremony, nom_date, nom_time, awards_date, awards_time
       FROM events
      ORDER BY abbreviation`,
  );

  const shows = rows.rows.map((row) => {
    const nomDate = row.nom_date == null ? null : Number(row.nom_date);
    const nomTime = row.nom_time == null ? null : Number(row.nom_time);
    const awardsDate = row.awards_date == null ? null : Number(row.awards_date);
    const awardsTime = row.awards_time == null ? null : Number(row.awards_time);

    const nomInstant = nomDate == null ? null : nomDate + (nomTime ?? 0);
    const awardsInstant = awardsDate == null ? null : awardsDate + (awardsTime ?? 0);

    return {
      id: row.id,
      abbreviation: row.abbreviation,
      name: row.name,
      // D129: a show with no ceremony (the AFI) has no awards half at all.
      hasCeremony: row.has_ceremony !== false,
      nomDate,
      nomTime,
      awardsDate,
      awardsTime,
      nomInstant,
      awardsInstant,
      nomCurrent: isInSeason(nomInstant, activeYear),
      // A ceremony that does not exist is never outstanding.
      awardsCurrent: row.has_ceremony === false || isInSeason(awardsInstant, activeYear),
      // What to reuse when a source gives a date but no time. These are stable
      // per show — SAG announces at 10:00 ET, WGA at 11:00, most at 8:00.
      nomTimeOfDay: nomTime,
      awardsTimeOfDay: awardsTime,
    };
  });

  return { activeYear, shows };
}

/** Default announcement times, used only when a show has no prior value. */
const DEFAULT_NOM_TIME = '08:00';
const DEFAULT_AWARDS_TIME = '20:00';

/** Every problem with a dates plan, as sentences. Empty means it may be applied. */
export function validateDatesPlan(plan, shows) {
  const problems = [];
  const known = new Set(shows.map((show) => show.abbreviation.toLowerCase()));

  if (plan.kind !== 'dates') problems.push('kind must be "dates"');
  if (!Number.isSafeInteger(plan.year) || plan.year <= 0) {
    problems.push('year must be a positive integer');
  }
  if (!Array.isArray(plan.sources) || plan.sources.length === 0) {
    problems.push('the plan records no source URL');
  }

  for (const entry of plan.shows ?? []) {
    const abbreviation = (entry.abbreviation ?? '').toLowerCase();
    if (!known.has(abbreviation)) {
      problems.push(`"${entry.abbreviation}" is not a show`);
      continue;
    }
    if (entry.nominations == null && entry.awards == null) {
      problems.push(
        `${entry.abbreviation} names neither a nominations date nor an awards date`,
      );
    }
    for (const field of ['nominations', 'awards']) {
      const given = entry[field];
      if (given == null) continue;
      if (!DATE_PATTERN.test(given.date ?? '')) {
        problems.push(`${entry.abbreviation} ${field} date must be YYYY-MM-DD`);
      }
      if (given.time != null && !TIME_PATTERN.test(given.time)) {
        problems.push(`${entry.abbreviation} ${field} time must be HH:MM`);
      }
    }
  }

  return problems;
}

/**
 * Write each season's schedule.
 *
 * 🔴 Everything that can refuse does so before the first UPDATE, so a refusal
 * never leaves half a season's calendar entered.
 *
 * 🔴 A field already current for this season is skipped rather than rewritten,
 * which is what makes this safe to re-run monthly as shows announce. `recheck`
 * on an entry overrides that, for a date that has moved.
 *
 * 🔴 A column is never nulled. An entry that omits `awards` leaves both
 * ceremony columns exactly as they were — a show that has not announced keeps
 * last season's value and is reported, rather than losing it.
 */
export async function applyDates(client, plan, state, { commit, secret }) {
  const problems = validateDatesPlan(plan, state.shows);
  if (problems.length > 0) {
    throw new Error(`this plan cannot be applied:\n  - ${problems.join('\n  - ')}`);
  }

  const noCeremony = (plan.shows ?? []).filter(
    (entry) =>
      entry.awards != null &&
      state.shows.find(
        (show) => show.abbreviation.toLowerCase() === entry.abbreviation.toLowerCase(),
      )?.hasCeremony === false,
  );
  if (noCeremony.length > 0) {
    throw new Error(
      noCeremony.map((entry) => `${entry.abbreviation} has no ceremony`).join('; '),
    );
  }

  if (plan.year !== state.activeYear) {
    throw new Error(
      `plan year ${plan.year} is not the active season ${state.activeYear} — ` +
        'fix the plan, or change the active season first',
    );
  }

  const byAbbreviation = new Map(
    state.shows.map((show) => [show.abbreviation.toLowerCase(), show]),
  );
  const changes = [];
  const skipped = [];

  for (const entry of plan.shows) {
    const show = byAbbreviation.get(entry.abbreviation.toLowerCase());

    for (const field of ['nominations', 'awards']) {
      const given = entry[field];
      if (given == null) continue;

      const isNominations = field === 'nominations';
      const alreadyCurrent = isNominations ? show.nomCurrent : show.awardsCurrent;
      if (alreadyCurrent && entry.recheck !== true) {
        skipped.push({
          abbreviation: show.abbreviation,
          field,
          reason: `already set for the ${state.activeYear} season`,
        });
        continue;
      }

      const tz = given.tz ?? ET;
      const existingTime = isNominations ? show.nomTimeOfDay : show.awardsTimeOfDay;
      const existingDate = isNominations ? show.nomDate : show.awardsDate;
      let time = given.time;
      let timeDefaulted = false;
      if (time == null && existingTime == null) {
        time = isNominations ? DEFAULT_NOM_TIME : DEFAULT_AWARDS_TIME;
        timeDefaulted = true;
      } else if (time == null) {
        // 🔴 The stored time is ms past UTC midnight, not a wall clock: 8:00 AM
        // ET is stored as 13h. Read it back in the zone at the instant it was
        // stored for, so the reused time is the show's wall-clock time and a
        // January 8pm reused for a March ceremony is 8pm EDT, not 9pm.
        const stored =
          (existingDate ?? Date.parse(`${given.date}T00:00:00Z`)) + existingTime;
        time = msToHhmm(stored + zoneOffsetMs(stored, tz));
      }

      const split = toDateTimeSplit({ date: given.date, time, tz });
      const instant = split.date + split.time;

      if (!isInSeason(instant, state.activeYear)) {
        throw new Error(
          `${show.abbreviation} ${field} ${formatEt(instant)} is outside the ` +
            `${state.activeYear} season — this is usually the wrong year's announcement`,
        );
      }

      changes.push({
        abbreviation: show.abbreviation,
        id: show.id,
        field,
        fromInstant: isNominations ? show.nomInstant : show.awardsInstant,
        toInstant: instant,
        date: split.date,
        time: split.time,
        timeDefaulted,
      });
    }
  }

  if (!commit) return { changes, skipped };

  // 🔴 Before the first write, not after: written-but-not-revalidated leaves
  // production serving the old schedule with nothing left to say so.
  if (!secret) {
    throw new Error(
      'REVALIDATE_SECRET is not set — refusing to write dates the cache could not be cleared for',
    );
  }

  await client.query('BEGIN');
  try {
    for (const change of changes) {
      const [date, time] =
        change.field === 'nominations'
          ? ['nom_date', 'nom_time']
          : ['awards_date', 'awards_time'];
      await client.query(
        `UPDATE events SET ${date} = $1, ${time} = $2, updated_at = now() WHERE id = $3`,
        [change.date, change.time, change.id],
      );
      // The season's own copy (D134): `events` is overwritten next year.
      await client.query(
        `INSERT INTO event_dates (year, event_id, ${date}, ${time}) VALUES ($1, $2, $3, $4)
         ON CONFLICT (year, event_id)
         DO UPDATE SET ${date} = EXCLUDED.${date}, ${time} = EXCLUDED.${time}, updated_at = now()`,
        [plan.year, change.id, change.date, change.time],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return { changes, skipped };
}

/**
 * A stored time-of-day back into `HH:MM`, so a reused time round-trips through
 * the same conversion a fresh one does.
 *
 * Takes the remainder past a whole day first: an evening ceremony's stored
 * time exceeds 24 hours, and `25:00` is not a wall clock.
 */
export function msToHhmm(ms) {
  const withinDay = ((ms % DAY) + DAY) % DAY;
  const hours = Math.floor(withinDay / HOUR);
  const minutes = Math.floor((withinDay % HOUR) / 60000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

import { pathToFileURL } from 'node:url';

const COMMANDS = ['context', 'apply', 'finish', 'refresh', 'dates', 'set-dates'];

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
      const report =
        plan.kind === 'winners'
          ? await applyWinners(client, plan, context, { commit })
          : await applyNominations(client, plan, context, { commit });
      const wrote = report.inserted ?? report.set;

      console.log(commit ? 'WROTE:' : 'DRY RUN — nothing written:');
      const person = (row) => (row.detailName ? ` — ${row.detailName}` : '');
      for (const row of wrote)
        console.log(`  + ${row.awardName}: ${row.title}${person(row)}`);
      const created = report.created ?? [];
      for (const row of report.skipped)
        console.log(`  = ${row.title}${person(row)} (${row.reason})`);
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

  if (command === 'finish') {
    const commit = rest.includes('--commit');
    const kind = rest.includes('--winners') ? 'winners' : 'nominations';
    const at = rest.indexOf('--message');
    const message = at === -1 ? undefined : rest[at + 1];

    const client = await connect();
    try {
      const context = await loadContext(client, rest[0]);
      const result = await finishShow(client, context, { message, kind, commit });
      console.log(
        `${commit ? 'SENT' : 'DRY RUN'}: "${message}" to ${result.recipients} members, ` +
          `${result.flag} → false` +
          (commit ? '' : ' — re-run with --commit to send. This cannot be undone.'),
      );
    } finally {
      await client.end();
    }
  }

  if (command === 'refresh') {
    const abbreviation = rest[0];
    const yearArg = rest[rest.indexOf('--year') + 1];
    const titlesArg = rest.includes('--titles') ? rest[rest.indexOf('--titles') + 1] : '';
    const explicitTitles = titlesArg
      ? titlesArg.split(',').map((title) => title.trim())
      : [];

    const client = await connect();
    let year = Number(yearArg);
    let context;
    try {
      context = await loadContext(client, abbreviation);
      if (!Number.isSafeInteger(year)) year = context.activeYear;
    } finally {
      await client.end();
    }

    // The titles are what to prove render on the live page. Default to what
    // is actually in the database for this show and season — the point of
    // `refresh` is to verify something real, not to require the caller to
    // retype titles by hand.
    const derivedTitles = [
      ...new Set(
        context.existingNominations.map((row) => row.title).filter((title) => title),
      ),
    ];
    const titles = explicitTitles.length > 0 ? explicitTitles : derivedTitles;
    if (titles.length === 0) {
      throw new Error(
        'nothing to verify — no titles given and none found in the database for ' +
          `${abbreviation} ${year}`,
      );
    }

    const result = await refresh({
      abbreviation: abbreviation.toLowerCase(),
      year,
      titles,
      baseUrl: process.env.SITE_URL ?? 'https://cinemadraft.com',
      secret: process.env.REVALIDATE_SECRET ?? null,
    });

    console.log(`revalidated: ${result.revalidated.join(', ')}`);
    if (result.missing.length > 0) {
      console.error(`NOT VISIBLE on the live page: ${result.missing.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('every title checked is visible on the live page');
    }
  }

  if (command === 'dates') {
    const client = await connect();
    try {
      const { activeYear, shows } = await loadDates(client);
      console.log(`active season: ${activeYear}\n`);
      for (const show of shows) {
        const needs = [];
        if (!show.nomCurrent) needs.push('nominations');
        if (!show.awardsCurrent) needs.push('ceremony');
        console.log(
          `${show.abbreviation.padEnd(7)} ${needs.length === 0 ? 'skip  ' : 'RESEARCH'} ${show.name}`,
        );
        console.log(
          `        nominations ${formatEt(show.nomInstant).padEnd(28)} ${show.nomCurrent ? 'current' : 'not this season'}`,
        );
        console.log(
          show.hasCeremony
            ? `        ceremony    ${formatEt(show.awardsInstant).padEnd(28)} ${show.awardsCurrent ? 'current' : 'not this season'}`
            : '        ceremony    no ceremony',
        );
      }
      const outstanding = shows.filter((show) => !show.nomCurrent || !show.awardsCurrent);
      console.log(
        `\n${outstanding.length} of ${shows.length} shows need research: ` +
          outstanding.map((show) => show.abbreviation).join(', '),
      );
    } finally {
      await client.end();
    }
  }

  if (command === 'set-dates') {
    const planPath = rest.find((arg) => !arg.startsWith('--'));
    const commit = rest.includes('--commit');
    const secret = process.env.REVALIDATE_SECRET ?? null;
    const { readFileSync } = await import('node:fs');
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));

    const client = await connect();
    try {
      const state = await loadDates(client);
      const report = await applyDates(client, plan, state, { commit, secret });

      console.log(commit ? 'WROTE:' : 'DRY RUN — nothing written:');
      for (const change of report.changes) {
        console.log(
          `  ${change.abbreviation.padEnd(7)} ${change.field.padEnd(12)} ` +
            `${formatEt(change.fromInstant)}  →  ${formatEt(change.toInstant)}` +
            (change.timeDefaulted ? '  (no prior time — default used)' : ''),
        );
      }
      for (const skip of report.skipped) {
        console.log(`  = ${skip.abbreviation} ${skip.field} (${skip.reason})`);
      }
      console.log(
        `${report.changes.length} to change, ${report.skipped.length} skipped` +
          (commit ? '' : ' — re-run with --commit to write'),
      );

      if (commit && report.changes.length > 0) {
        const baseUrl = process.env.SITE_URL ?? 'https://cinemadraft.com';
        for (const abbreviation of new Set(
          report.changes.map((change) => change.abbreviation.toLowerCase()),
        )) {
          const posted = await fetch(`${baseUrl}/api/revalidate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ secret, abbreviation }),
          });
          console.log(
            `  revalidate ${abbreviation}: ${posted.ok ? 'ok' : `FAILED ${posted.status}`}`,
          );
          if (!posted.ok) process.exitCode = 1;
        }
      }
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
