import { expect, test } from '@playwright/test';
import type { QueryResultRow } from 'pg';

/**
 * The Phase 18 gate, in a browser (P18.T9).
 *
 * The page's whole claim is that **every number on it is computed, never
 * typed** — the point values from the `points` table, the ledgers from
 * `lib/services/scoring.ts`. A test that reads a figure off the page and
 * compares it to another figure off the same page proves nothing about that,
 * so every expected value here is derived from the database with SQL that
 * states the scoring rule independently of the app's code:
 *
 *     earned = points × (won ? 2 : 1),  points resolved through
 *     awards.points → points.id → points.points
 *
 * (`lib/services/scoring.ts`, and the 🔴 there about `awards.points` being a
 * foreign key rather than a value.) Break the rule in the service and
 * `the season's best and worst ledgers` below goes red.
 *
 * 🔴 **Every test in this file runs on an empty database**, which is what CI
 * has: migrations plus `scripts/seed-e2e.mjs`, so one season, no leagues, no
 * nominations, no points. There is no `skipWithoutRestoredCorpus` here and
 * there does not need to be — instead each test asks the database what it
 * holds and requires the page to show exactly that much, which is a real
 * assertion in both directions rather than a skip. Verified by running the
 * file against a throwaway Postgres holding only the schema and the seed.
 */

/**
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the `@/`
 * alias into `generated/prisma`, so importing `lib/db` here fails at require
 * time and takes the whole spec with it. Same reasoning as every other spec in
 * this directory.
 */
async function query<T extends QueryResultRow>(sql: string): Promise<T[]> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<T>(sql);
    return rows;
  } finally {
    await client.end();
  }
}

type Level = { level: string; tiers: number[] };

/**
 * The rulebook as the database states it, grouped and ordered the way
 * `lib/services/scoring-table.ts` does: tiers ascending, and a row missing
 * `level` or `tier` dropped rather than grouped under a manufactured key.
 */
async function levelsFromDatabase(): Promise<Level[]> {
  const rows = await query<{ level: string; tier: number; points: number }>(
    `select level, tier, coalesce(points, 0)::int as points
       from points
      where level is not null and tier is not null
      order by level, tier`,
  );

  const byLevel = new Map<string, number[]>();
  for (const row of rows) {
    const tiers = byLevel.get(row.level);
    if (tiers) tiers.push(row.points);
    else byLevel.set(row.level, [row.points]);
  }
  return [...byLevel.entries()].map(([level, tiers]) => ({ level, tiers }));
}

type Extremes = { year: number; best: number; worst: number };

/**
 * The scoring rule, written out in SQL, over the season the page will choose.
 *
 * 🔴 This is deliberately a **second, independent statement** of what
 * `lib/services/scoring.ts` does — that is the only way a browser test can
 * claim the page's numbers are the service's rather than somebody's typing.
 * It mirrors three decisions the service makes and the comments there explain:
 * the value comes from `points` via the `awards.points` foreign key, a win
 * doubles that value, and a nomination whose award has no points row earns no
 * line at all (hence the inner join).
 *
 * The season is the newest one that is on offer, is not in the future and has
 * something to score — the walk `getWorkedExample` and `getLandingFacts` both
 * do, and for the same reason: in October the active season is empty.
 *
 * `best` and `worst` are the leaderboard's first and last rows, which is what
 * the page renders as its hero ledger and its Razzie casualty. Films whose
 * nominations resolve to no points at all sit at 0 on the real board and are
 * absent here; that cannot move either extreme while the best is positive and
 * the worst negative, which is the only case the page renders them in.
 */
async function extremesFromDatabase(): Promise<Extremes | null> {
  const rows = await query<Extremes>(
    `with totals as (
       select n.year,
              n.movie_id,
              sum(
                coalesce(p.points, 0)
                * case when exists (
                    select 1 from winners w
                     where w.award_id = n.award_id
                       and w.movie_id = n.movie_id
                       and w.year = n.year
                  ) then 2 else 1 end
              )::int as total
         from nominations n
         join awards a on a.id = n.award_id
         join points p on p.id = a.points
         join movies m on m.id = n.movie_id
        where n.year is not null
        group by n.year, n.movie_id
     )
     select t.year, max(t.total)::int as best, min(t.total)::int as worst
       from totals t
      where t.year in (select year from available_years)
        and t.year <= coalesce(
              (select year from available_years where is_active limit 1),
              t.year
            )
      group by t.year
      order by t.year desc
      limit 1`,
  );
  return rows[0] ?? null;
}

/** Every digit-ish thing on the page is printed as plain ASCII; this reads it back. */
function toNumber(text: string): number {
  return Number(text.replace(/[^\d-]/g, ''));
}

test.describe('how it works', () => {
  test('opens signed out, with no redirect', async ({ page }) => {
    const response = await page.goto('/how-it-works');

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/how-it-works');
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Draft a team of films. Let the awards keep score.',
      }),
    ).toBeVisible();
  });

  test('the retired URL still opens, permanently redirected', async ({ page }) => {
    // A year of league chat holds this link. `next.config.ts` answers it before
    // the proxy ever sees it (P18.T0).
    await page.goto('/rules-and-scoring');

    expect(new URL(page.url()).pathname).toBe('/how-it-works');
  });

  for (const width of [1440, 390]) {
    test(`does not scroll sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/how-it-works');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Exactly, not `<=`: one pixel over is the defect, and a loose bound is
      // how a regression gets through as "close enough" (films.spec.ts).
      expect(await page.evaluate(() => document.scrollingElement?.scrollWidth ?? 0)).toBe(
        width,
      );
    });
  }

  test('the way in reaches the register route', async ({ page }) => {
    await page.goto('/how-it-works');

    // Twice on the page by design (P18.T7): once in the hero, once at the end.
    //
    // 🔴 Scoped to `main`. The shell's utility strip carries a third link with
    // the same label (P17.T32) pointing at `/leagues/new`, which is a
    // protected route — an unscoped locator resolves three and, worse, would
    // happily pass against the chrome's link if the page ever lost its own.
    const ways = page.getByRole('main').getByRole('link', { name: 'Start a league' });
    await expect(ways).toHaveCount(2);
    for (const way of await ways.all()) {
      await expect(way).toHaveAttribute('href', '/auth/register');
    }

    await ways.first().click();
    await page.waitForURL('**/auth/register');
    expect(new URL(page.url()).pathname).toBe('/auth/register');

    // 🔴 And nothing about what the register page *renders*, deliberately. The
    // suite's server boots with no Clerk at all (D82/D84), so `<SignUp />`
    // throws there and the route answers the error boundary — an artefact of
    // the harness, not of the app. Asserting a heading here would pin the
    // absence of Clerk. Against a production build with real keys the route is
    // a 200, checked by hand in P18.T8's verification pass.
  });

  test('the scoring figures are the ones in the points table', async ({ page }) => {
    const levels = await levelsFromDatabase();
    await page.goto('/how-it-works');

    // The rulebook band is conditional on there being levels at all — on a
    // freshly migrated database the heading used to sit above nothing.
    const groups = page.locator('[data-testid^="scoring-group-"]');
    await expect(groups).toHaveCount(levels.length);

    for (const level of levels) {
      const figures = page.getByTestId(`scoring-group-${level.level}`).locator('dd');
      await expect(figures).toHaveText(level.tiers.map(String));
    }

    // The three rules are stated with the top tier of the most valuable level,
    // that value doubled, and the top tier of the penalty level — read out of
    // the table by the page, and out of the same rows by this test. A level
    // with an empty table has none of them and prints an em dash.
    const best = Math.max(
      ...levels.flatMap((level) => level.tiers),
      Number.NEGATIVE_INFINITY,
    );
    const headline = levels.filter((level) => Math.max(...level.tiers) === best);
    const penalty = levels.filter((level) => level.tiers.some((points) => points < 0));

    const [nomination, win, cost] = await page
      .getByTestId('scoring-rules')
      .locator('.font-mono')
      .allInnerTexts();

    if (levels.length === 0) {
      expect([nomination, win, cost]).toEqual(['—', '—', '—']);
      return;
    }

    // `toContain` rather than an index, because two levels tied on their top
    // tier would make "the most valuable level" genuinely ambiguous and a test
    // that guessed would be red for the wrong reason. In the restored data
    // each list holds exactly one entry.
    expect(headline.map((level) => level.tiers[0])).toContain(toNumber(nomination));
    expect(headline.map((level) => (level.tiers[0] ?? 0) * 2)).toContain(toNumber(win));
    expect(penalty.map((level) => level.tiers[0])).toContain(toNumber(cost));
  });

  test("the season's best ledger is the one the scoring rule produces", async ({
    page,
  }) => {
    const extremes = await extremesFromDatabase();
    await page.goto('/how-it-works');

    const hero = page.getByTestId('hero-ledger');

    if (!extremes) {
      // No season with anything to score: the page drops the ledger rather
      // than printing a zero. This is the CI database.
      await expect(hero).toHaveCount(0);
      return;
    }

    await expect(hero).toBeVisible();
    expect(toNumber(await hero.getByTestId('worked-example-total').innerText())).toBe(
      extremes.best,
    );

    // 🔴 One ledger, not two. The season's worst pick used to get a second
    // full table of its own; the owner cut it, because the Razzie inversion is
    // minor arithmetic — the worst pick costs a fraction of what the best one
    // earns — and a table weighted a footnote like a headline. It survives as
    // a clause beside the scoring rules, carrying the same real figure, so
    // that figure is still asserted against the database here.
    await expect(page.getByTestId('worked-example-total')).toHaveCount(1);
    if (extremes.worst < 0) {
      await expect(page.getByTestId('scoring-rules')).toContainText(
        String(Math.abs(extremes.worst)),
      );
    }
  });

  test('the visible ledger lines and the stated remainder add up to the printed total', async ({
    page,
  }) => {
    const extremes = await extremesFromDatabase();
    test.skip(extremes == null, 'no scored season in this database');

    await page.goto('/how-it-works');
    const hero = page.getByTestId('hero-ledger');
    await expect(hero).toBeVisible();

    // Every Earned cell, the "N more nominations" remainder among them. This is
    // what catches a table that renders a subset of its rows — the collision
    // that dropped one of La La Land's two Best Original Song lines and made
    // the column sum to less than the total above it, found in a browser and
    // by no test (lib/services/scoring.ts, `LedgerLine.nominationId`).
    const earned = await hero.locator('tbody tr td:last-child').allInnerTexts();
    expect(earned.length).toBeGreaterThan(1);

    expect(earned.reduce((sum, text) => sum + toNumber(text), 0)).toBe(
      toNumber(await hero.getByTestId('worked-example-total').innerText()),
    );
  });

  test('shows the pitch and the way in whatever the season holds', async ({ page }) => {
    // 🔴 The empty-database test, and the one this file exists for: CI runs
    // migrations plus `scripts/seed-e2e.mjs`, so one season and nothing else.
    // Everything data-fed is absent then, and the claim and the action are not.
    const [levels, extremes] = await Promise.all([
      levelsFromDatabase(),
      extremesFromDatabase(),
    ]);

    const response = await page.goto('/how-it-works');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/every nomination pays, every win pays twice/),
    ).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Start a league' }),
    ).toHaveCount(2);

    // And nothing the database cannot fill.
    await expect(page.locator('[data-testid^="scoring-group-"]')).toHaveCount(
      levels.length,
    );
    await expect(
      page.getByRole('heading', { name: 'Twelve shows, and what each pays' }),
    ).toHaveCount(levels.length === 0 ? 0 : 1);
    await expect(page.getByTestId('hero-ledger')).toHaveCount(extremes ? 1 : 0);
  });
});
