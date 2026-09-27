#!/usr/bin/env node
// Capture every figure the SOURCE app scored, keyed by id, for the port's
// differential test (lib/services/scoring.differential.test.ts).
//
//   SRC_DB=postgres://cinemadraft:local@localhost:5460/cinemadraft \
//     node scripts/capture-scoring-differential.cjs
//   node scripts/capture-scoring-differential.cjs --from /tmp/scoring-audit/src-out.json
//
// The first form runs the source app's own `server/routes/points.js` router and
// Sequelize controllers, unmodified, against SRC_DB — a THROWAWAY restore of
// `.local/prod-dump.dump` (PascalCase, Postgres 17) on a port of 5460 or above,
// never an executor or the owner's database. The only stub is the TMDB image
// config, which touches poster URLs and nothing else. It is the harness the
// 2026-09-27 scoring audit ran; `--from` reduces that run's raw output instead.
//
// Writes test/scoring-differential.json: ids and numbers only. 🔴 The raw output
// carries members' names and uuids; the reduction drops them and then checks
// that not one survived, so the committed file cannot carry them.

const fs = require('node:fs');
const path = require('node:path');

const SRC = process.env.SRC_APP || '/Users/jonbernard/Development/cinemadraft';
const OUT = path.join(__dirname, '..', 'test', 'scoring-differential.json');

async function runSource() {
  const url = process.env.SRC_DB;
  if (!url) throw new Error('set SRC_DB, or pass --from <raw.json>');
  const port = Number(new URL(url).port);
  if (!(port >= 5460))
    throw new Error(`SRC_DB must be a throwaway restore on 5460+, not ${port}`);
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = url;

  const quiet = console.log;
  console.log = () => {};
  const express = require(`${SRC}/node_modules/express`);
  const R = require(`${SRC}/node_modules/ramda`);
  const pointsRouter = require(`${SRC}/server/routes/points.js`);
  const { Drafts, Leagues } = require(`${SRC}/server/controllers`);
  const models = require(`${SRC}/server/models`);
  console.log = quiet;
  require(`${SRC}/node_modules/memory-cache`).put('__express__tmbd_config', '{}');
  const { movieImagesMiddleware } = require(`${SRC}/server/config/movieImages.js`);

  const app = express();
  app.use(express.json());
  app.use(movieImagesMiddleware);
  await new Promise((resolve) => movieImagesMiddleware({}, {}, resolve));
  app.use('/points', pointsRouter);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (route, body) => {
    const response = await fetch(base + route, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  };
  const q = (sql) => models.sequelize.query(sql, { type: 'SELECT' });

  const out = { leagueTotals: [], pickPoints: [], byYear: [], byMovie: [] };
  for (const { leagueId, year } of await q(
    'select distinct "leagueId", year from "Drafts" order by 1,2',
  )) {
    const rows = await call(`/points/league/total/${leagueId}/${year}`);
    const league = await Leagues.getById({ params: { id: leagueId, year } });
    const selections = league.selections || [];
    const seats = selections.map((d) => ({
      draftId: d.id,
      dummyName: d.dummyName,
      uuid: d.user?.uuid ?? null,
      displayName: d.dummyName || d.user?.displayName,
      picks: d.picks.map((p) => p.movieId),
    }));
    const ids = R.pluck(
      'movieId',
      R.uniqBy(R.prop('movieId'), R.flatten(R.pluck('picks', selections))),
    );
    const totals = await call('/points/ids', { id: ids });
    for (const seat of seats) {
      seat.total = R.sum(
        R.reject(
          (p) => !p,
          seat.picks.map((id) => totals.body[id]),
        ),
      );
    }
    out.leagueTotals.push({
      leagueId,
      year,
      status: rows.status,
      rows: rows.body,
      seats,
    });
    // The explore view: one POST per group with that group's picks (list.js).
    const drafts = await Drafts.getByYear({ params: { id: leagueId, year } });
    const groups = R.groupBy(
      R.prop('group'),
      drafts.map((d) => d.toJSON()),
    );
    for (const group of Object.values(groups)) {
      const shown = await call('/points/ids', {
        id: R.pluck('movieId', R.flatten(R.pluck('picks', group))),
      });
      for (const d of group)
        for (const pick of d.picks)
          out.pickPoints.push({
            pickId: pick.id,
            shown: shown.body?.[pick.movieId] || 0,
          });
    }
  }
  for (const { year } of await q('select year from "AvailableYears" order by year')) {
    out.byYear.push({ year, ...(await call(`/points/year/${year}`)) });
  }
  const seen = new Set();
  for (const { tmdbId } of await q(
    'select m."tmdbId" from "Movies" m where exists (select 1 from "Nominations" n where n."movieId" = m.id) order by m.id',
  )) {
    if (seen.has(tmdbId)) continue;
    seen.add(tmdbId);
    out.byMovie.push({ tmdbId, ...(await call(`/points/movie/${tmdbId}`)) });
  }
  server.close();
  await models.sequelize.close();
  return { raw: out, R };
}

function reduce(raw, R) {
  const bad = (what) => {
    throw new Error(`source answered non-200 for ${what}`);
  };
  // Keys sorted: two shows can share a date, and the source's column order
  // between them is whatever Postgres returned that run.
  const nonzero = (cells) =>
    Object.fromEntries(
      Object.entries(cells)
        .filter(([, v]) => v !== 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    );

  const standings = [];
  const seats = [];
  for (const lt of raw.leagueTotals) {
    if (lt.status !== 200) bad(`league ${lt.leagueId}/${lt.year}`);
    // The endpoint's rows carry names, not draft ids. Rebuild them from the
    // seats exactly as points.js does — sortBy(total), then reverse — and
    // refuse to go on unless the rebuild matches the endpoint row for row.
    const order = R.sortBy(R.prop('total'), lt.seats).reverse();
    const rebuilt = order.map((s) => ({
      displayName: s.displayName,
      total: s.total,
      uuid: s.uuid ?? undefined,
    }));
    if (JSON.stringify(rebuilt) !== JSON.stringify(lt.rows))
      throw new Error(`cannot key ${lt.leagueId}/${lt.year}'s standings by draft id`);
    // 🔴 Tied seats are put in draft-id order here, because the source never
    // had a tie order: its seat list is in whatever order Postgres returns, and
    // two runs against one dump ordered the ties of 1/2017, 1/2022 and 1/2026
    // differently. Everything else in the order is the source's, and this
    // keeps the file byte-identical from run to run.
    const canonical = [...order].sort(
      (a, b) => b.total - a.total || a.draftId - b.draftId,
    );
    standings.push([lt.leagueId, lt.year, canonical.map((s) => s.draftId)]);
    for (const s of lt.seats) seats.push([lt.leagueId, lt.year, s.draftId, s.total]);
  }
  seats.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

  const filmSeasons = raw.byYear.flatMap((y) => {
    if (y.status !== 200) bad(`year ${y.year}`);
    return y.body.points.map((r) => [
      y.year,
      Number(r.movieId),
      r.total,
      nonzero(r.events),
    ]);
  });

  const filmPages = raw.byMovie.map((m) => {
    if (m.status !== 200) bad(`movie ${m.tmdbId}`);
    // `{}`: the page resolved a duplicate row that holds no nominations (Solo).
    if (m.body.total === undefined) return [m.tmdbId, null, null, {}];
    const shows = Object.fromEntries(m.body.events.map((e) => [e.abbreviation, e.total]));
    return [m.tmdbId, m.body.total, m.body.avgDraftPos, nonzero(shows)];
  });

  const fixture = {
    about:
      "The source app's own scoring, captured by scripts/capture-scoring-differential.cjs. Ids only. Do not edit by hand.",
    counts: {
      filmSeasons: filmSeasons.length,
      seats: seats.length,
      picks: raw.pickPoints.length,
      standings: standings.length,
      filmPages: filmPages.length,
    },
    filmSeasons,
    seats,
    picks: raw.pickPoints.map((p) => [p.pickId, p.shown]),
    standings,
    filmPages,
  };

  // 🔴 Not one person may survive the reduction.
  const text = JSON.stringify(fixture);
  const people = new Set();
  const add = (...values) => {
    for (const value of values) if (value) people.add(value);
  };
  for (const lt of raw.leagueTotals) {
    for (const row of lt.rows) add(row.displayName, row.uuid);
    for (const s of lt.seats) add(s.displayName, s.dummyName, s.uuid);
  }
  for (const value of people) {
    if (text.includes(JSON.stringify(value)))
      throw new Error('a name or uuid survived the reduction');
  }
  return fixture;
}

(async () => {
  const from = process.argv.indexOf('--from');
  let raw;
  let R;
  if (from > 0) {
    raw = JSON.parse(fs.readFileSync(process.argv[from + 1], 'utf8'));
    R = require(`${SRC}/node_modules/ramda`);
  } else {
    ({ raw, R } = await runSource());
  }
  const fixture = reduce(raw, R);
  // One record per line: diffable, and small enough to read.
  const lines = Object.entries(fixture).map(([key, value]) =>
    Array.isArray(value)
      ? `  ${JSON.stringify(key)}: [\n${value.map((v) => `    ${JSON.stringify(v)}`).join(',\n')}\n  ]`
      : `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`,
  );
  fs.writeFileSync(OUT, `{\n${lines.join(',\n')}\n}\n`);
  console.error('wrote', OUT, fixture.counts);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
