# Award Entry Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner say "DGA nominations" and have a skill research the listing, propose every nomination for approval, write them to production, clear the render cache, and broadcast one notification.

**Architecture:** A single `.mjs` script holds every invariant and is the only thing that touches Neon, driven over the command line with `DATABASE_URL` passed explicitly. A skill file holds the research procedure and the approval gates. One new route, `/api/revalidate`, exists solely because `revalidatePath` has no out-of-process equivalent — the script cannot clear the cache the server actions clear.

**Tech Stack:** Node 24 ESM, `pg` (already a devDependency), Vitest, Next 16 route handler, Biome.

**Spec:** `docs/superpowers/specs/2026-09-12-award-entry-pipeline-design.md`

## Global Constraints

- **Biome, not ESLint/Prettier.** `npm run lint` covers lint, format and import order. `npm run typecheck` is separate and does not run Biome.
- **No new dependencies.** `pg` is already in `devDependencies`; the script uses it and `node:crypto` only. If a dependency ever is added, `package.json` is edited by `npm install <pkg>` and the lockfile by `npm run lock` — **never** a bare `npm install` committed from macOS.
- **`scripts/*.test.mjs` runs in both Vitest projects and on CI.** `vitest.config.mts` globs `**/*.{test,spec}.?(c|m)[jt]s?(x)` and routes anything that cannot reach `lib/db.ts` into the `parallel` project. Script tests must therefore never import `lib/db` or open a connection — pass the DB client in.
- **`awards.points` is a foreign key into `points.id`, never a point value** (D41). Nothing in this plan reads it as a number.
- **`events.nom_active = true` means "needs nominations."** Finishing a nominations run sets it to `false`.
- **Production is reached only by an explicit `DATABASE_URL` on the command line.** The script never loads `.env`, `.env.local` or `.env.neon`.
- **Every subcommand is read-only unless `--commit` is passed.**
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

### Task 1: The script's pure core

The parts with no database and no network: plan validation, category matching, and the year check. Written first so the invariants exist before anything can write.

**Files:**
- Create: `scripts/award-import.mjs`
- Create: `scripts/award-import.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `normalizeCategory(name: string): string`
  - `matchCategory(heading: string, awards: {id: number, name: string}[]): {id: number, name: string} | null`
  - `validatePlan(plan: object, awards: {id: number, name: string, requiresNomineeName: boolean}[]): string[]` — returns an array of human-readable problems; empty means valid.
  - `yearCheck(input: {nominatedYears: number[], seasonYears: number[]}): {ok: boolean, reason: string | null}`

- [ ] **Step 1: Write the failing tests**

Create `scripts/award-import.test.mjs`:

```javascript
import { describe, expect, it } from 'vitest';

import {
  matchCategory,
  normalizeCategory,
  validatePlan,
  yearCheck,
} from './award-import.mjs';

const AWARDS = [
  { id: 10, name: 'Outstanding Directorial Achievement in Theatrical Feature Film', requiresNomineeName: true },
  { id: 11, name: 'Best Picture', requiresNomineeName: false },
];

describe('matchCategory', () => {
  it('matches an exact heading', () => {
    expect(matchCategory('Best Picture', AWARDS)?.id).toBe(11);
  });

  // Listings vary in punctuation and case; the award row is the authority.
  it('matches ignoring case, punctuation and stray whitespace', () => {
    expect(matchCategory('  best   picture:', AWARDS)?.id).toBe(11);
  });

  // 🔴 The failure that matters: a near-miss heading must NOT be guessed into
  // a real category, because a wrong category pays the wrong points to the
  // wrong film and nothing on the page would look odd.
  it('returns null rather than guessing at an unknown heading', () => {
    expect(matchCategory('Best Documentary Feature', AWARDS)).toBe(null);
  });
});

describe('normalizeCategory', () => {
  it('strips punctuation, collapses whitespace and lowercases', () => {
    expect(normalizeCategory('  Best   PICTURE: ')).toBe('best picture');
  });
});

describe('validatePlan', () => {
  const plan = {
    kind: 'nominations',
    eventAbbreviation: 'DGA',
    eventId: 7,
    year: 2025,
    sources: ['https://example.com/listing'],
    categories: [
      {
        awardId: 11,
        awardName: 'Best Picture',
        nominees: [{ title: 'One Battle After Another', tmdbId: '1234567' }],
      },
    ],
  };

  it('accepts a well-formed plan', () => {
    expect(validatePlan(plan, AWARDS)).toEqual([]);
  });

  // A person category with no name renders a category listing four films and
  // a blank, which reads as a data-entry mistake nobody made.
  it('rejects a person category whose nominee has no detailName', () => {
    const bad = {
      ...plan,
      categories: [
        { awardId: 10, awardName: 'Directing', nominees: [{ title: 'X', tmdbId: '1' }] },
      ],
    };
    expect(validatePlan(bad, AWARDS)).toContain(
      'award 10 requires a nominee name: "X" has none',
    );
  });

  it('rejects an awardId that does not belong to this event', () => {
    const bad = { ...plan, categories: [{ awardId: 99, awardName: 'Nope', nominees: [] }] };
    expect(validatePlan(bad, AWARDS)).toContain('award 99 does not belong to this event');
  });

  it('rejects a plan with no sources recorded', () => {
    expect(validatePlan({ ...plan, sources: [] }, AWARDS)).toContain(
      'the plan records no source URL',
    );
  });

  it('rejects an unknown kind', () => {
    expect(validatePlan({ ...plan, kind: 'guesses' }, AWARDS)).toContain(
      'kind must be "nominations" or "winners"',
    );
  });
});

describe('yearCheck', () => {
  // The season honours the previous year's films (D57): 507 of the 2026
  // season's 526 nominations are 2025 releases.
  it('passes when the nominated films sit in the season the picks sit in', () => {
    expect(
      yearCheck({
        nominatedYears: [2025, 2025, 2025, 2026, 2025],
        seasonYears: [2025, 2025, 2024, 2025, 2026],
      }).ok,
    ).toBe(true);
  });

  // 🔴 The one failure that produces a full, plausible, entirely wrong season.
  it('refuses when most nominated films fall outside the season range', () => {
    const result = yearCheck({
      nominatedYears: [2023, 2023, 2023, 2024],
      seasonYears: [2025, 2025, 2026],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/2023/);
  });

  // A season whose draft has not happened yet has no picks to compare against.
  // Refusing there would block the first show of every season.
  it('passes when the season has no picks to compare against', () => {
    expect(yearCheck({ nominatedYears: [2025, 2025], seasonYears: [] }).ok).toBe(true);
  });

  it('passes when nothing was nominated', () => {
    expect(yearCheck({ nominatedYears: [], seasonYears: [2025] }).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: FAIL — cannot resolve `./award-import.mjs`.

- [ ] **Step 3: Write the pure core**

Create `scripts/award-import.mjs`:

```javascript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: PASS, 12 tests.

- [ ] **Step 5: Mutation-check the year heuristic**

Temporarily change `outside.length * 2 <= known.length` to `outside.length * 3 <= known.length` and re-run. Expected: the "refuses when most nominated films fall outside" test still fails the mutant, i.e. the suite goes red. Revert the change. A guard whose test cannot fail is worse than no guard.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add scripts/award-import.mjs scripts/award-import.test.mjs
git commit -m "feat(scripts): award-import pure core — plan validation, category match, year check

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `context` — read production, print what the skill needs

**Files:**
- Modify: `scripts/award-import.mjs`

**Interfaces:**
- Consumes: Task 1's exports.
- Produces:
  - `connect(): Promise<import('pg').Client>` — refuses without `DATABASE_URL`.
  - `loadContext(client, abbreviation): Promise<Context>` where `Context` is
    `{event: {id, name, abbreviation, nomActive, awardsActive}, awards: {id, name, requiresNomineeName, points}[], activeYear: number, existingNominations: {awardId, movieId, title}[], seasonYears: number[]}`
  - CLI: `node scripts/award-import.mjs context DGA`

- [ ] **Step 1: Add the connection guard and the context loader**

Append to `scripts/award-import.mjs`:

```javascript
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
    const all = await client.query('SELECT abbreviation FROM events ORDER BY abbreviation');
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
```

- [ ] **Step 2: Add the CLI dispatcher**

Append to `scripts/award-import.mjs`:

```javascript
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
```

- [ ] **Step 3: Verify the guard fires with no DATABASE_URL**

Run: `node scripts/award-import.mjs context DGA`
Expected: exits non-zero with "DATABASE_URL is not set", no stack trace about connections.

- [ ] **Step 4: Verify against the local database**

```bash
npm run db:up
DATABASE_URL='postgresql://cinemadraft:local@localhost:5433/cinemadraft' \
  node scripts/award-import.mjs context DGA | head -40
```
Expected: the "NOT production" warning on stderr, then JSON with the event, its awards carrying **resolved** point values, and `activeYear`. Spot-check one award's `points` against the `/award-shows/dga` page — if a category shows `1` where the page says `5`, the join is wrong.

- [ ] **Step 5: Verify the unknown-abbreviation path**

Run the same command with `context NOPE`.
Expected: exits non-zero, lists every known abbreviation.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add scripts/award-import.mjs
git commit -m "feat(scripts): award-import context — read the show, its awards and the season

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `apply` — resolve films and write nominations

**Files:**
- Modify: `scripts/award-import.mjs`
- Modify: `scripts/award-import.test.mjs`

**Interfaces:**
- Consumes: `connect`, `loadContext`, `validatePlan`, `yearCheck` from Tasks 1–2.
- Produces:
  - `movieInsertColumns(): string[]` — the exact column list, pinned by test.
  - `resolveFilm(client, {title, tmdbId}, fetchFilm): Promise<{movieId, title, releaseYear, created}>`
  - `applyNominations(client, plan, context, {commit}): Promise<Report>` where `Report` is `{inserted: {awardId, title}[], skipped: {awardId, title, reason}[], created: string[]}`
  - CLI: `node scripts/award-import.mjs apply plan.json [--commit]`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/award-import.test.mjs`:

```javascript
import { applyNominations, movieInsertColumns, resolveFilm } from './award-import.mjs';

/** A pg-shaped stub: hand it queries to match, collect what was run. */
function fakeClient(handlers) {
  const ran = [];
  return {
    ran,
    async query(text, params) {
      ran.push({ text, params });
      for (const [pattern, rows] of handlers) {
        if (pattern.test(text)) return { rows: typeof rows === 'function' ? rows(params) : rows };
      }
      return { rows: [] };
    },
  };
}

describe('movieInsertColumns', () => {
  // 🔴 Pinned against movieRepository.upsertByTmdbId in lib/repositories/movies.ts.
  // The script cannot import that file (TypeScript behind @/ aliases), so this
  // test is the only thing standing between the two copies and silent drift.
  it('writes exactly the columns the repository writes', () => {
    expect(movieInsertColumns()).toEqual([
      'tmdb_id',
      'imdb_id',
      'title',
      'sort_title',
      'poster',
      'backdrop',
      'release_date',
      'created_at',
      'updated_at',
    ]);
  });
});

describe('resolveFilm', () => {
  it('returns the cached row without asking TMDB', async () => {
    const client = fakeClient([
      [/FROM movies WHERE tmdb_id/, [{ id: 42, title: 'Sinners', release_date: new Date('2025-04-18') }]],
    ]);
    const fetchFilm = () => {
      throw new Error('TMDB must not be called for a cached film');
    };
    const result = await resolveFilm(client, { title: 'Sinners', tmdbId: '1233413' }, fetchFilm);
    expect(result).toEqual({ movieId: 42, title: 'Sinners', releaseYear: 2025, created: false });
  });

  it('ingests an unknown film and reports it as created', async () => {
    const client = fakeClient([
      [/FROM movies WHERE tmdb_id/, []],
      [/INSERT INTO movies/, [{ id: 99, title: 'One Battle After Another', release_date: new Date('2025-09-26') }]],
    ]);
    const fetchFilm = async () => ({
      tmdbId: '1234567',
      imdbId: '1234567',
      title: 'One Battle After Another',
      sortTitle: 'One Battle After Another',
      poster: '/p.jpg',
      backdrop: null,
      releaseDate: new Date('2025-09-26'),
    });
    const result = await resolveFilm(client, { title: 'One Battle After Another', tmdbId: '1234567' }, fetchFilm);
    expect(result.movieId).toBe(99);
    expect(result.created).toBe(true);
  });

  it('throws rather than writing a half-film when TMDB has nothing', async () => {
    const client = fakeClient([[/FROM movies WHERE tmdb_id/, []]]);
    await expect(
      resolveFilm(client, { title: 'Ghost', tmdbId: '0' }, async () => null),
    ).rejects.toThrow(/Ghost/);
  });
});

describe('applyNominations', () => {
  const context = {
    event: { id: 7, name: 'DGA', abbreviation: 'DGA', nomActive: true, awardsActive: false },
    awards: [{ id: 11, name: 'Best Picture', requiresNomineeName: false, points: 5 }],
    activeYear: 2025,
    existingNominations: [],
    seasonYears: [2025],
  };
  const plan = {
    kind: 'nominations',
    eventAbbreviation: 'DGA',
    eventId: 7,
    year: 2025,
    sources: ['https://example.com'],
    categories: [
      { awardId: 11, awardName: 'Best Picture', nominees: [{ title: 'Sinners', tmdbId: '1233413' }] },
    ],
  };

  const cached = [
    [/FROM movies WHERE tmdb_id/, [{ id: 42, title: 'Sinners', release_date: new Date('2025-04-18') }]],
  ];

  it('writes nothing without --commit', async () => {
    const client = fakeClient(cached);
    const report = await applyNominations(client, plan, context, { commit: false });
    expect(report.inserted).toHaveLength(1);
    expect(client.ran.some((call) => /INSERT INTO nominations/.test(call.text))).toBe(false);
  });

  it('inserts inside a transaction when committing', async () => {
    const client = fakeClient(cached);
    await applyNominations(client, plan, context, { commit: true });
    const texts = client.ran.map((call) => call.text);
    expect(texts).toContain('BEGIN');
    expect(texts).toContain('COMMIT');
    expect(texts.some((text) => /INSERT INTO nominations/.test(text))).toBe(true);
  });

  // 🔴 A double-run would double that film's points for the category.
  it('skips a nomination that already exists', async () => {
    const client = fakeClient(cached);
    const report = await applyNominations(
      client,
      plan,
      { ...context, existingNominations: [{ awardId: 11, movieId: 42, title: 'Sinners' }] },
      { commit: true },
    );
    expect(report.inserted).toHaveLength(0);
    expect(report.skipped[0].reason).toMatch(/already nominated/);
  });

  it('refuses the whole run when the plan is invalid', async () => {
    const client = fakeClient(cached);
    await expect(
      applyNominations(client, { ...plan, sources: [] }, context, { commit: true }),
    ).rejects.toThrow(/source URL/);
    expect(client.ran.some((call) => /INSERT/.test(call.text))).toBe(false);
  });

  // The listing was a year off — the failure this whole pipeline exists to catch.
  it('refuses the whole run when the year check fails', async () => {
    const client = fakeClient([
      [/FROM movies WHERE tmdb_id/, [{ id: 42, title: 'Sinners', release_date: new Date('2022-04-18') }]],
    ]);
    await expect(
      applyNominations(client, plan, { ...context, seasonYears: [2025, 2026] }, { commit: true }),
    ).rejects.toThrow(/outside/);
    expect(client.ran.some((call) => /INSERT INTO nominations/.test(call.text))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: FAIL — `applyNominations is not a function`.

- [ ] **Step 3: Implement film resolution and the apply pass**

Append to `scripts/award-import.mjs`:

```javascript
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
      releaseYear: existing.release_date ? new Date(existing.release_date).getFullYear() : null,
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
```

- [ ] **Step 4: Wire `apply` into the dispatcher**

In `main`, after the `context` branch:

```javascript
  if (command === 'apply') {
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
      const report = await applyNominations(client, plan, context, { commit });

      console.log(commit ? 'WROTE:' : 'DRY RUN — nothing written:');
      for (const row of report.inserted) console.log(`  + ${row.awardName}: ${row.title}`);
      for (const row of report.skipped) console.log(`  = ${row.title} (${row.reason})`);
      if (report.created.length > 0) {
        console.log(`  films newly cached from TMDB: ${report.created.join(', ')}`);
      }
      for (const heading of plan.unmatched ?? []) console.log(`  ! unmatched: ${heading}`);
      console.log(
        `${report.inserted.length} to insert, ${report.skipped.length} skipped` +
          (commit ? '' : ' — re-run with --commit to write'),
      );
    } finally {
      await client.end();
    }
  }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: PASS, all tests including the seven new ones.

- [ ] **Step 6: Dry-run against the local database**

Write `/tmp/plan.json` naming one real award id from `context DGA` output and one film already in `movies`, then:

```bash
DATABASE_URL='postgresql://cinemadraft:local@localhost:5433/cinemadraft' \
  node scripts/award-import.mjs apply /tmp/plan.json
```
Expected: the resolution list prints, and `SELECT count(*) FROM nominations` is unchanged. Verify that count before and after.

- [ ] **Step 7: Commit**

```bash
npm run lint
git add scripts/award-import.mjs scripts/award-import.test.mjs
git commit -m "feat(scripts): award-import apply — resolve films, refuse a wrong-year listing, write nominations

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `apply` in winners mode

**Files:**
- Modify: `scripts/award-import.mjs`
- Modify: `scripts/award-import.test.mjs`

**Interfaces:**
- Consumes: Task 3's `resolveFilm`, `validatePlan`.
- Produces: `applyWinners(client, plan, context, {commit}): Promise<{set: {awardId, title}[], skipped: []}>`, and `apply` dispatching on `plan.kind`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/award-import.test.mjs`:

```javascript
import { applyWinners } from './award-import.mjs';

describe('applyWinners', () => {
  const context = {
    event: { id: 7, name: 'DGA', abbreviation: 'DGA', nomActive: false, awardsActive: true },
    awards: [{ id: 11, name: 'Best Picture', requiresNomineeName: false, points: 5 }],
    activeYear: 2025,
    existingNominations: [{ awardId: 11, movieId: 42, title: 'Sinners' }],
    seasonYears: [2025],
  };
  const plan = {
    kind: 'winners',
    eventAbbreviation: 'DGA',
    eventId: 7,
    year: 2025,
    sources: ['https://example.com'],
    categories: [
      { awardId: 11, awardName: 'Best Picture', nominees: [{ title: 'Sinners', tmdbId: '1233413' }] },
    ],
  };
  const handlers = [
    [/FROM movies WHERE tmdb_id/, [{ id: 42, title: 'Sinners', release_date: new Date('2025-04-18') }]],
    [/FROM nominations/, [{ id: 500 }]],
  ];

  // 🔴 A win pays the award's points a second time, so a winner that was never
  // nominated scores for a nomination that does not exist — the film would hold
  // points no page could explain. Same refusal as setWinner.
  it('refuses a winner that is not nominated in that category', async () => {
    const client = fakeClient([handlers[0], [/FROM nominations/, []]]);
    await expect(applyWinners(client, plan, context, { commit: true })).rejects.toThrow(
      /not nominated/,
    );
    expect(client.ran.some((call) => /INSERT INTO winners/.test(call.text))).toBe(false);
  });

  // One category has one winner. Two rows would pay the points twice.
  it('deletes the category existing winner before inserting', async () => {
    const client = fakeClient(handlers);
    await applyWinners(client, plan, context, { commit: true });
    const texts = client.ran.map((call) => call.text);
    const deleteAt = texts.findIndex((text) => /DELETE FROM winners/.test(text));
    const insertAt = texts.findIndex((text) => /INSERT INTO winners/.test(text));
    expect(deleteAt).toBeGreaterThanOrEqual(0);
    expect(insertAt).toBeGreaterThan(deleteAt);
  });

  it('writes nothing without --commit', async () => {
    const client = fakeClient(handlers);
    const report = await applyWinners(client, plan, context, { commit: false });
    expect(report.set).toHaveLength(1);
    expect(client.ran.some((call) => /INSERT INTO winners/.test(call.text))).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: FAIL — `applyWinners is not a function`.

- [ ] **Step 3: Implement**

Append to `scripts/award-import.mjs`:

```javascript
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
```

In the `apply` branch of `main`, replace the single `applyNominations` call with:

```javascript
      const report =
        plan.kind === 'winners'
          ? await applyWinners(client, plan, context, { commit })
          : await applyNominations(client, plan, context, { commit });
      const wrote = report.inserted ?? report.set;
```

and print `wrote` in place of `report.inserted` (keeping `report.skipped` and `report.created ?? []` as they are).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run lint
git add scripts/award-import.mjs scripts/award-import.test.mjs
git commit -m "feat(scripts): award-import winners mode — replace, never add, and refuse a non-nominee

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `/api/revalidate` — the cache clear the script cannot do itself

**Security-bearing: this task gets a review pass before it merges.**

**Files:**
- Create: `app/api/revalidate/route.ts`
- Create: `app/api/revalidate/route.test.ts`
- Modify: `lib/env.ts`
- Modify: `proxy.ts` (add to `isPublic`)
- Modify: `.env.local` (add `REVALIDATE_SECRET`, not committed — `.env*` is gitignored)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `POST /api/revalidate` accepting `{secret: string, abbreviation: string}`, answering `{revalidated: string[]}` or 404.

- [ ] **Step 1: Write the failing test**

Create `app/api/revalidate/route.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// revalidatePath needs a request store no test has; the call itself is the
// behaviour under test, so it is recorded rather than performed.
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { POST } from './route';

function request(body: unknown): Request {
  return new Request('https://cinemadraft.com/api/revalidate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  revalidatePath.mockClear();
  process.env.REVALIDATE_SECRET = 'correct-horse-battery-staple';
});

describe('POST /api/revalidate', () => {
  it('revalidates the show, the index, the leaderboard and the home page', async () => {
    const response = await POST(request({ secret: 'correct-horse-battery-staple', abbreviation: 'dga' }));

    expect(response.status).toBe(200);
    expect(revalidatePath.mock.calls).toEqual([
      ['/award-shows/dga', 'layout'],
      ['/award-shows'],
      ['/leaderboard'],
      ['/'],
    ]);
  });

  // 🔴 404, not 401: a 401 confirms the route exists and that the secret is
  // the only thing missing, which is free help toward guessing one.
  it('answers 404 to a wrong secret and revalidates nothing', async () => {
    const response = await POST(request({ secret: 'wrong', abbreviation: 'dga' }));
    expect(response.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('answers 404 to a missing secret', async () => {
    const response = await POST(request({ abbreviation: 'dga' }));
    expect(response.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  // 🔴 The caller names a show, never a path. Otherwise this is an open
  // invalidation endpoint for every route in the app.
  it('refuses an abbreviation that is not a plain slug', async () => {
    const response = await POST(
      request({ secret: 'correct-horse-battery-staple', abbreviation: '../../admin' }),
    );
    expect(response.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('answers 404 when the server has no secret configured', async () => {
    process.env.REVALIDATE_SECRET = '';
    const response = await POST(request({ secret: 'anything', abbreviation: 'dga' }));
    expect(response.status).toBe(404);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/api/revalidate/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Add the secret to `lib/env.ts`**

Append to `lib/env.ts`:

```typescript
/**
 * The shared secret for `/api/revalidate`.
 *
 * Nullable rather than `required()`: a deployment without it should make the
 * route answer 404 — indistinguishable from the route not existing — rather
 * than crash a request. It clears caches and reads nothing, so a missing
 * secret degrades one operator workflow; it is not a security failure the way
 * a missing webhook secret is.
 */
export const revalidateEnv = {
  get secret(): string | null {
    return process.env.REVALIDATE_SECRET || null;
  },
};
```

- [ ] **Step 4: Write the route**

Create `app/api/revalidate/route.ts`:

```typescript
import { timingSafeEqual } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { revalidateEnv } from '@/lib/env';

/**
 * Clear the render cache for an award show, from outside the app.
 *
 * 🔴 **Why this route exists at all** (D8 says HTTP endpoints do not).
 * `scripts/award-import.mjs` writes nominations straight to Neon, which is the
 * only way to enter a whole show at once — the server actions are Clerk-gated
 * and not callable from a script. Those actions all end in
 * `revalidatePath('/award-shows/<abbr>', 'layout')`, and `revalidatePath` has
 * no out-of-process equivalent. So the script asks the running app to make the
 * call it cannot make itself. A webhook is HTTP by definition; so is this.
 *
 * 🔴 **The caller names a show, never a path.** Accepting a path would be an
 * unauthenticated-shaped invalidation endpoint for every route in the app. The
 * abbreviation is checked against a slug pattern and interpolated into a fixed
 * list.
 *
 * 🔴 **404 on a bad secret, not 401.** A 401 tells a prober the route is real
 * and that the secret is the only thing between them and it.
 *
 * It writes nothing and reads nothing. The worst an attacker holding the
 * secret can do is make four pages re-render.
 */
const SLUG = /^[a-z0-9-]{1,50}$/i;

function secretMatches(given: unknown): boolean {
  const expected = revalidateEnv.secret;
  if (!expected || typeof given !== 'string') return false;

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length through the error path.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  let body: { secret?: unknown; abbreviation?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('not found', { status: 404 });
  }

  if (!secretMatches(body.secret)) return new Response('not found', { status: 404 });

  const abbreviation = body.abbreviation;
  if (typeof abbreviation !== 'string' || !SLUG.test(abbreviation)) {
    return new Response('bad abbreviation', { status: 400 });
  }

  const paths = [`/award-shows/${abbreviation}`, '/award-shows', '/leaderboard', '/'];
  revalidatePath(paths[0] as string, 'layout');
  revalidatePath('/award-shows');
  revalidatePath('/leaderboard');
  revalidatePath('/');

  return Response.json({ revalidated: paths });
}
```

- [ ] **Step 5: Make the route public in `proxy.ts`**

In the `isPublic` matcher list, immediately after the `'/api/webhooks/(.*)'` entry, add:

```typescript
  // 🔴 Public for the same reason as the webhook: it authenticates by shared
  // secret, not by session, because the caller is a script and has none. It
  // reads nothing and writes nothing — it only asks four pages to re-render.
  // See app/api/revalidate/route.ts.
  '/api/revalidate',
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run app/api/revalidate/route.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Confirm the test runs on CI**

Run: `npx vitest run --config vitest.ci.config.mts app/api/revalidate/route.test.ts`
Expected: PASS. This test seeds nothing and touches no database, so it belongs on every push like every other security test. If it lands in the `db` project instead, something in the route's import graph reaches `lib/db.ts` — find it and remove it rather than excluding the test.

- [ ] **Step 8: Set the secret locally and on Vercel**

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# add the value to .env.local as REVALIDATE_SECRET=… (gitignored)
vercel env add REVALIDATE_SECRET production
```

- [ ] **Step 9: Typecheck, lint and commit**

```bash
npm run typecheck && npm run lint
git add app/api/revalidate/route.ts app/api/revalidate/route.test.ts lib/env.ts proxy.ts
git commit -m "feat(api): /api/revalidate — clear an award show's cache from outside the app

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `finish` and `refresh`

The notification, the `nom_active` flip, and the cache clear that proves itself.

**Files:**
- Modify: `scripts/award-import.mjs`
- Modify: `scripts/award-import.test.mjs`

**Interfaces:**
- Consumes: `connect`, `loadContext`.
- Produces:
  - `finishShow(client, context, {message, kind, commit}): Promise<{recipients: number, flag: string}>`
  - `refresh({abbreviation, year, titles, baseUrl, secret, fetchImpl}): Promise<{revalidated: string[], missing: string[]}>`
  - CLI: `finish DGA --message "…" [--winners] [--commit]`, `refresh DGA [--year N] [--titles a,b,c]`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/award-import.test.mjs`:

```javascript
import { finishShow, refresh } from './award-import.mjs';

describe('finishShow', () => {
  const context = {
    event: { id: 7, name: 'DGA', abbreviation: 'dga', nomActive: true, awardsActive: false },
    awards: [],
    activeYear: 2025,
    existingNominations: [],
    seasonYears: [],
  };

  it('refuses an empty message rather than broadcasting a blank', async () => {
    const client = fakeClient([]);
    await expect(
      finishShow(client, context, { message: '   ', kind: 'nominations', commit: true }),
    ).rejects.toThrow(/message/);
    expect(client.ran).toHaveLength(0);
  });

  it('counts recipients without writing when not committing', async () => {
    const client = fakeClient([[/FROM users/, [{ count: '61' }]]]);
    const result = await finishShow(client, context, {
      message: 'DGA nominations are in.',
      kind: 'nominations',
      commit: false,
    });
    expect(result.recipients).toBe(61);
    expect(client.ran.some((call) => /INSERT INTO notifications/.test(call.text))).toBe(false);
  });

  // nom_active = true means "needs nominations" — finishing turns it off.
  it('clears nom_active and links the notification at the show', async () => {
    const client = fakeClient([[/FROM users/, [{ count: '2' }]]]);
    await finishShow(client, context, {
      message: 'DGA nominations are in.',
      kind: 'nominations',
      commit: true,
    });
    const update = client.ran.find((call) => /UPDATE events/.test(call.text));
    expect(update.text).toMatch(/nom_active = false/);
    const insert = client.ran.find((call) => /INSERT INTO notifications/.test(call.text));
    expect(insert.params).toContain('/award-shows/dga');
  });

  it('clears awards_active for a winners run', async () => {
    const client = fakeClient([[/FROM users/, [{ count: '2' }]]]);
    await finishShow(client, { ...context, event: { ...context.event, awardsActive: true } }, {
      message: 'The DGA winners are in.',
      kind: 'winners',
      commit: true,
    });
    expect(client.ran.find((call) => /UPDATE events/.test(call.text)).text).toMatch(
      /awards_active = false/,
    );
  });
});

describe('refresh', () => {
  it('posts the secret, then confirms the titles render', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/api/revalidate')) {
        return { ok: true, status: 200, async json() { return { revalidated: ['/award-shows/dga'] }; } };
      }
      return { ok: true, status: 200, async text() { return '<h2>Sinners</h2>'; } };
    };

    const result = await refresh({
      abbreviation: 'dga',
      year: 2025,
      titles: ['Sinners'],
      baseUrl: 'https://cinemadraft.com',
      secret: 's3cret',
      fetchImpl,
    });

    expect(JSON.parse(calls[0].init.body).secret).toBe('s3cret');
    expect(calls[1].url).toBe('https://cinemadraft.com/award-shows/dga?year=2025');
    expect(result.missing).toEqual([]);
  });

  // 🔴 The check that makes the revalidation honest. A 200 from the endpoint
  // proves nothing about what the reader sees.
  it('reports a title that does not appear on the live page', async () => {
    const fetchImpl = async (url) =>
      String(url).endsWith('/api/revalidate')
        ? { ok: true, status: 200, async json() { return { revalidated: [] }; } }
        : { ok: true, status: 200, async text() { return '<h2>Something else</h2>'; } };

    const result = await refresh({
      abbreviation: 'dga',
      year: 2025,
      titles: ['Sinners'],
      baseUrl: 'https://cinemadraft.com',
      secret: 's3cret',
      fetchImpl,
    });
    expect(result.missing).toEqual(['Sinners']);
  });

  it('throws rather than silently skipping the clear when no secret is set', async () => {
    await expect(
      refresh({
        abbreviation: 'dga',
        year: 2025,
        titles: [],
        baseUrl: 'https://cinemadraft.com',
        secret: null,
        fetchImpl: async () => ({ ok: true }),
      }),
    ).rejects.toThrow(/REVALIDATE_SECRET/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: FAIL — `finishShow is not a function`.

- [ ] **Step 3: Implement**

Append to `scripts/award-import.mjs`:

```javascript
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
    await client.query(`UPDATE events SET ${column} = false, updated_at = now() WHERE id = $1`, [
      context.event.id,
    ]);
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
export async function refresh({ abbreviation, year, titles, baseUrl, secret, fetchImpl = fetch }) {
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
    throw new Error(`/api/revalidate answered ${posted.status} — the cache was not cleared`);
  }
  const { revalidated } = await posted.json();

  const page = await fetchImpl(`${baseUrl}/award-shows/${abbreviation}?year=${year}`);
  const html = await page.text();
  const missing = titles.filter((title) => !html.includes(title));

  return { revalidated, missing };
}
```

- [ ] **Step 4: Wire both into the dispatcher**

In `main`, after the `apply` branch:

```javascript
  if (command === 'finish') {
    const commit = rest.includes('--commit');
    const kind = rest.includes('--winners') ? 'winners' : 'nominations';
    const message = rest[rest.indexOf('--message') + 1];

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

    const client = await connect();
    let year = Number(yearArg);
    try {
      if (!Number.isSafeInteger(year)) {
        year = (await loadContext(client, abbreviation)).activeYear;
      }
    } finally {
      await client.end();
    }

    const result = await refresh({
      abbreviation: abbreviation.toLowerCase(),
      year,
      titles: titlesArg ? titlesArg.split(',').map((title) => title.trim()) : [],
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
```

- [ ] **Step 5: Run the whole script suite**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: PASS, all tests.

- [ ] **Step 6: Verify `finish` dry-run against local**

```bash
DATABASE_URL='postgresql://cinemadraft:local@localhost:5433/cinemadraft' \
  node scripts/award-import.mjs finish DGA --message "DGA nominations are in."
```
Expected: prints the real recipient count and `nom_active → false`, and `SELECT count(*) FROM notifications` is unchanged. Check that count before and after.

- [ ] **Step 7: Commit**

```bash
npm run lint
git add scripts/award-import.mjs scripts/award-import.test.mjs
git commit -m "feat(scripts): award-import finish and refresh — broadcast, clear the cache, prove it rendered

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The skill

**Files:**
- Create: `.claude/skills/award-entry/SKILL.md`
- Modify: `AGENTS.md` (one line under "Other conventions")

**Interfaces:**
- Consumes: every command from Tasks 2–6.
- Produces: the invocation surface — "DGA nominations", "Oscars winners", "SAG live".

- [ ] **Step 1: Write the skill**

Create `.claude/skills/award-entry/SKILL.md`:

```markdown
---
name: award-entry
description: Use when entering an award show's nominations or winners — "DGA nominations", "Oscars winners", "run the SAG show live". Researches the listing, proposes every nomination for approval, writes to production, clears the cache, and broadcasts one notification.
---

# Entering an award show

Three modes, one procedure. Mode comes from the ask:

| Ask | Mode |
|---|---|
| "DGA nominations" | nominations — research a listing, enter every category |
| "Oscars winners" | winners — one listing, every category at once |
| "run the Oscars live" | live — one category at a time, as they are announced |

## Before anything else

```bash
export PROD="$(grep -m1 '^DATABASE_URL' .env.neon | cut -d= -f2- | tr -d '\"')"
DATABASE_URL="$PROD" node scripts/award-import.mjs context <ABBR>
```

This prints the show, its real category names and award ids, the active season,
what is already entered, and the release years of this season's draft picks.

**Read it before searching the web.** Category headings come from the `awards`
rows, never from the article. If the abbreviation is unknown the command lists
every show — ask which one.

## Nominations

1. **Search** for the announcement. Prefer one page listing every category.
   Record every URL you used.
2. **Map** each heading in the article to an `awards.id` from `context`. A
   heading with no matching award goes in the plan's `unmatched` array. Never
   file a nomination under a near-miss category — a wrong category pays that
   category's points and the page renders it without a hint anything is wrong.
3. **Find each film on TMDB** and put its id in `tmdbId`. For a category with
   `requiresNomineeName: true`, `detailName` is the person; it is required and
   `apply` refuses without it.
4. **Write the plan** to `.local/award-plans/<abbr>-<year>-nominations.json`
   (gitignored; it names films before the site does):

   ```json
   {
     "kind": "nominations",
     "eventAbbreviation": "DGA",
     "eventId": 7,
     "year": 2025,
     "sources": ["https://…"],
     "unmatched": [],
     "categories": [
       {
         "awardId": 42,
         "awardName": "Outstanding Directorial Achievement in Theatrical Feature Film",
         "nominees": [
           { "title": "One Battle After Another", "tmdbId": "1234567", "detailName": "Paul Thomas Anderson" }
         ]
       }
     ]
   }
   ```

5. **Dry run**, and show the owner the output plus anything unmatched:

   ```bash
   DATABASE_URL="$PROD" TMDB_API_KEY="$(grep -m1 '^TMDB_API_KEY' .env.local | cut -d= -f2-)" \
     node scripts/award-import.mjs apply .local/award-plans/<file>.json
   ```

6. **STOP. Wait for approval.** Nothing writes until the owner says go.
7. **Commit**, then refresh:

   ```bash
   DATABASE_URL="$PROD" TMDB_API_KEY="…" node scripts/award-import.mjs apply <plan> --commit
   DATABASE_URL="$PROD" REVALIDATE_SECRET="$(grep -m1 '^REVALIDATE_SECRET' .env.local | cut -d= -f2-)" \
     node scripts/award-import.mjs refresh DGA --titles "Sinners,One Battle After Another"
   ```

   `refresh` is not optional. It is the only thing that clears the cache the
   server actions clear, and it fails loudly if the new nominees are not
   actually on the live page.

8. **Draft the announcement** — one sentence, from the counts in the plan, e.g.
   *"One Battle After Another leads the DGA nominations with four."* Show it,
   get approval, then:

   ```bash
   DATABASE_URL="$PROD" node scripts/award-import.mjs finish DGA --message "…" --commit
   ```

   This is irreversible — the app has no notification deletion.

## The year

`context` gives the active season and that is what goes in `year`. Never take
it from the article's title: "Oscars 2026" means the **2025** season, and other
shows go the other way.

`apply` checks this empirically — it compares the release years of the films it
resolved against this season's draft picks and refuses if most fall outside.
**If it refuses, do not override it.** Go find a different listing, or ask the
owner for a link.

## Winners

Same as nominations with `"kind": "winners"`. The film must already be
nominated in that category or `apply` refuses — that refusal is load-bearing: a
win pays the category's points a second time, so a winner that was never
nominated holds points no page can explain.

`finish` takes `--winners`, which clears `awards_active` instead of
`nom_active`.

## Live mode

No research. The owner says a winner; you write a one-category plan and run
`apply --commit` then `refresh` immediately, so the site is current within
seconds. Run `finish --winners --commit` once, at the end of the night.

## Never

- Never create an `awards` row. Categories are set up once per show in the
  admin UI; report an unmatched heading instead.
- Never pass `--commit` before the owner has seen the dry run.
- Never skip `refresh` — a correct write nobody can see is not done.
- Never run any of this against `localhost:5433` expecting it to matter, or
  against `$PROD` expecting it not to.
```

- [ ] **Step 2: Note the pipeline in `AGENTS.md`**

Add under "Other conventions":

```markdown
- **Award nominations and winners are entered by the `award-entry` skill**, not
  by hand through the admin UI. It drives `scripts/award-import.mjs`, which is
  the only thing that writes scoring inputs to production, and always ends with
  `refresh` — the script cannot call `revalidatePath`, so
  `app/api/revalidate/route.ts` does it on the script's behalf.
```

- [ ] **Step 3: Verify the skill loads**

Start a fresh Claude Code session in the repo and check that `award-entry`
appears in the available-skills list. Expected: it is listed with its
description. If not, check the frontmatter `name` matches the directory name.

- [ ] **Step 4: Full verification**

Run: `npm run verify`
Expected: lint, typecheck, layering, both Vitest projects and the build all
pass. If `layering.sh` objects to `app/api/revalidate/route.ts`, read
`scripts/layering.sh` — the route imports only `lib/env` and `next/cache`, so
an objection means the rule needs the route listed, not that the route needs
restructuring.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/award-entry/SKILL.md AGENTS.md
git commit -m "feat(skills): award-entry — research, approve, write, refresh, notify

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage**

| Spec section | Task |
|---|---|
| `context` | 2 |
| `apply` (nominations) | 3 |
| `apply` (winners mode) | 4 |
| `finish` | 6 |
| `refresh` | 6 |
| `/api/revalidate` (§1b) | 5 |
| Skill file (§2) | 7 |
| Plan file schema (§3) | 3 (consumed), 7 (documented) |
| The year check | 1 (rule), 3 (enforced) |
| Scores / cache clear | 5, 6 |
| Safety rails 1–7 | 2 (1, 6), 3 (2, 3, 4), 6 (5, 7) |
| Testing | 1, 3, 4, 5, 6 |

**Known gap, accepted:** the spec allows a plan to omit `tmdbId` and have
`apply` resolve by title, reporting ambiguity. This plan requires `tmdbId` on
every nominee — the skill looks the film up while researching, which it is
already doing, and title-matching against TMDB from the script would be a
second search implementation competing with `lib/services/search-ranking.ts`.
`validatePlan` rejects a nominee with no title; add `tmdbId` to that check if
the looser path is ever wanted.

**Type consistency:** `Report.inserted` (nominations) and `Report.set`
(winners) differ deliberately; the dispatcher reads `report.inserted ??
report.set`. `loadContext` returns `awards[].requiresNomineeName` in camelCase,
which is what `validatePlan` and `matchCategory` consume in every task.
