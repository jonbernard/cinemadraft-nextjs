import { expect, type Page, test } from '@playwright/test';

import { signInAs } from '../support/session';
import { beat, DEMO_PACE, startJourney } from './support/pace';
import {
  assertNoResidue,
  cleanupLeague,
  cleanupShow,
  cleanupUsers,
  withDb,
} from './support/scratch';

/**
 * Journey 2: a member reads their league back — teams, rosters, standings, the
 * ledger, and a score that moves while they watch.
 *
 * 🔴 **It does not read journey 1's rows, on purpose.** `docs/PLAN.md` T3 says
 * "scores that moved because of what journey 1 did", and taken literally that
 * is cross-file state: `playwright.config.mts` is `fullyParallel: true` so file
 * order is not guaranteed, journey 1 deletes everything it made in its own
 * `afterAll`, and a journey that cannot be run alone cannot be used to
 * diagnose anything. So this seeds the *shape* journey 1 leaves — a finished
 * draft with picks and a nomination — and then moves a score itself. The
 * property under test is that four surfaces agree about one number, and that
 * is unchanged by who wrote the rows.
 *
 * `e2e/scoring.spec.ts` proves the same ledger property on league 1's real
 * 2025 board and **skips on CI** (see `e2e/support/corpus.ts`). This is the
 * CI-side proof, on scratch rows.
 *
 * The four surfaces, and why each one:
 *   - the **league board** (`getLeagueBoard`) — the number the league reads;
 *   - the **reader's own roster** on the same page, derived per-pick from the
 *     seat rather than from the board's cell;
 *   - the **standings** panel, ranked from the same seats;
 *   - the **season leaderboard** (`getLeaderboard`), a separate service over
 *     the same scoring rule (D41).
 * A defect a journey catches is exactly one of them disagreeing.
 */
const TAG = 'e2e-j2';

/**
 * A season of its own, registered as one.
 *
 * 🔴 The dashboard's leaderboard falls back to the newest *known* season for a
 * `?year=` it does not recognise (D65), so an unregistered year would quietly
 * report the real season's standings and every assertion below would be about
 * the wrong table. `is_active` stays false: `available_years_one_active` is a
 * global partial unique index and the suite's other specs are reading the real
 * active season while this runs.
 */
const YEAR = 2992;
const MEMBER = `${TAG}-member@example.test`;
const LEAGUE = `${TAG} league`;
const FILMS = ['Zephyrine', 'Quillon', 'Bastable'].map((word) => `${TAG} ${word}`);
/** The member's own pick — the one every surface is asked about. */
const MINE = FILMS[0] as string;

async function cleanup(): Promise<void> {
  // Shows first: `winners` and `nominations` point at the films `cleanupLeague`
  // removes.
  await cleanupShow(TAG);
  await cleanupLeague(TAG);
  await cleanupUsers(TAG);
  await withDb(async (query) => {
    // 🔴 The scratch season goes too — `lib/db.test.ts` asserts
    // `available_years` still holds exactly ten rows.
    await query('delete from available_years where year = $1', [YEAR]);
  });
}

type Seeded = {
  leagueId: number;
  awardId: number;
  movieId: number;
  nominationId: number;
};

/**
 * The shape journey 1 leaves behind: a finished draft, three seats, three
 * picks, and one nomination so there is a non-zero score to read before
 * anything moves.
 *
 * Seeded rather than clicked. What this journey is about is the *reading*, and
 * building a whole league through the UI first would make an unrelated failure
 * look like a scoring one — journey 1 is the file that proves the building.
 */
async function seed(memberId: number): Promise<Seeded> {
  return withDb(async (query) => {
    await query(
      `insert into available_years (year, is_active, created_at, updated_at)
         values ($1, false, now(), now())`,
      [YEAR],
    );

    const events = (await query(
      `insert into events (name, abbreviation, created_at, updated_at)
         values ($1, $2, now(), now()) returning id`,
      [`${TAG} Show`, `${TAG}-show`],
    )) as { id: number }[];

    const points = (await query(
      `insert into points (level, tier, points, created_at, updated_at)
         values ($1, 3, 7, now(), now()) returning id`,
      [`${TAG}-level`],
    )) as { id: number }[];

    // `awards.points` is a foreign key into `points.id` (D41), not a value.
    const awards = (await query(
      `insert into awards (name, event_id, points, created_at, updated_at)
         values ($1, $2, $3, now(), now()) returning id`,
      [`${TAG} Best Picture`, events[0]?.id, points[0]?.id],
    )) as { id: number }[];

    const movieIds: number[] = [];
    for (const title of FILMS) {
      const rows = (await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now()) returning id`,
        [title],
      )) as { id: number }[];
      movieIds.push(rows[0]?.id as number);
    }

    const leagues = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), 'complete', now(), now())
       returning id`,
      // Stored the way production stores it: TEXT holding a JSON array.
      [LEAGUE, JSON.stringify([memberId])],
    )) as { id: number }[];
    const leagueId = leagues[0]?.id as number;

    // The member's own seat first, then two placeholders — one group, three
    // seats, one pick each, which is what the standings rank.
    const seats: number[] = [];
    for (const [index, dummyName] of [null, 'Ada', 'Grace'].entries()) {
      const rows = (await query(
        `insert into drafts (user_id, league_id, year, "group", "order", dummy,
                             dummy_name, created_at, updated_at)
           values ($1, $2, $3, 1, $4, $5, $6, now(), now()) returning id`,
        [
          dummyName == null ? memberId : null,
          leagueId,
          YEAR,
          index + 1,
          dummyName != null,
          dummyName,
        ],
      )) as { id: number }[];
      seats.push(rows[0]?.id as number);
    }

    for (const [index, draftId] of seats.entries()) {
      await query(
        `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
           values ($1, $2, 1, now(), now())`,
        [draftId, movieIds[index]],
      );
    }

    const nominations = (await query(
      `insert into nominations (movie_id, award_id, year, created_at, updated_at)
         values ($1, $2, $3, now(), now()) returning id`,
      [movieIds[0], awards[0]?.id, YEAR],
    )) as { id: number }[];

    return {
      leagueId,
      awardId: awards[0]?.id as number,
      movieId: movieIds[0] as number,
      nominationId: nominations[0]?.id as number,
    };
  });
}

/**
 * The ceremony, in SQL.
 *
 * Written rather than clicked because **journey 3 is the journey about
 * clicking it**; here a win is only the input that makes a number move.
 */
async function crownWinner(seeded: Seeded): Promise<void> {
  await withDb(async (query) => {
    await query(
      `insert into winners (movie_id, award_id, nomination_id, year, created_at, updated_at)
         values ($1, $2, $3, $4, now(), now())`,
      [seeded.movieId, seeded.awardId, seeded.nominationId, YEAR],
    );
  });
}

/** The film's cell on the desktop board, scoped so the phone copy (D49) is not matched. */
function boardCell(page: Page, title: string) {
  return page
    .getByRole('table', { name: /Draft board/i })
    .first()
    .locator('figure')
    .filter({ hasText: title });
}

/** The number a member actually sees on the board: the ledger's own summary. */
async function totalOnBoard(page: Page, title: string): Promise<number> {
  const summary = boardCell(page, title).locator('summary');
  await expect(summary).toBeVisible();
  return Number((await summary.innerText()).match(/\d+/)?.[0] ?? Number.NaN);
}

/** The same film in the reader's own roster strip, which derives its own figure. */
async function totalInRoster(page: Page, title: string): Promise<number> {
  const caption = page
    .getByRole('list', { name: /Drafted films/i })
    .locator('figure')
    .filter({ hasText: title })
    .locator('figcaption');
  await expect(caption).toBeVisible();
  return Number((await caption.innerText()).match(/(\d+)\s*$/)?.[1] ?? Number.NaN);
}

/** The Total column of the season leaderboard, on the dashboard. */
async function totalOnLeaderboard(page: Page, title: string): Promise<number> {
  await page.goto(`/?year=${YEAR}`);
  const total = page.getByRole('row').filter({ hasText: title }).getByRole('cell').last();
  await expect(total).toBeVisible();
  return Number((await total.innerText()).trim());
}

test.describe('journey 2 — reading the league back', () => {
  // 🔴 The budget grows with the pacing: a fixed number ample at `DEMO_PACE=0`
  // fails at `DEMO_PACE=1` as a timeout on whichever beat happened to be last.
  test.describe.configure({ timeout: 120_000 + DEMO_PACE * 45_000 });

  test.beforeAll(cleanup);

  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG, [YEAR]);
  });

  test('four surfaces report one number, and all four move together', async ({
    page,
  }) => {
    await startJourney(page);
    const memberId = await signInAs(page, { email: MEMBER, firstName: 'Member' });
    const seeded = await seed(memberId);

    await beat(page, 'The member opens their leagues', async () => {
      await page.goto('/leagues');
      await expect(page.getByRole('link', { name: new RegExp(LEAGUE) })).toBeVisible();
      await expect(page.getByText('You run this one')).toBeVisible();
    });

    await beat(page, 'And the board for the season', async () => {
      await page.goto(`/leagues/${seeded.leagueId}?year=${YEAR}`);
      await expect(page.getByRole('heading', { name: LEAGUE })).toBeVisible();
      // The draft is over, so the board is a board rather than a running order.
      await expect(page.getByText(`${YEAR} · complete`)).toBeVisible();
      await expect(
        page.getByRole('table', { name: /Draft board/i }).first(),
      ).toBeVisible();
    });

    await beat(
      page,
      'Every team is on it, and the reader can find their own',
      async () => {
        const board = page.getByRole('table', { name: /Draft board/i }).first();
        for (const title of FILMS) {
          await expect(board.getByText(title, { exact: true })).toBeVisible();
        }
        // Not by colour alone — the seat is named as the reader's, and the row
        // says so to a screen reader as well.
        await expect(board.getByText('· You')).toBeVisible();
        await expect(board.locator('tr[aria-current="true"]')).toHaveCount(1);
      },
    );

    await beat(page, 'Standings rank all three seats, the reader marked', async () => {
      const standings = page.getByRole('table', { name: /League standings/i });
      await expect(standings).toBeVisible();
      // Three seats and a header row.
      await expect(standings.getByRole('row')).toHaveCount(4);
      await expect(standings.locator('tr[aria-current="true"]')).toHaveCount(1);
    });

    const before = await beat(page, 'A pick explains its own score', async () => {
      const cell = boardCell(page, MINE);
      const total = await totalOnBoard(page, MINE);
      // A nomination has been entered, so there is something to explain.
      expect(total).toBeGreaterThan(0);

      await cell.locator('summary').click();
      await expect(cell.locator('details')).toHaveAttribute('open', '');

      // 🔴 The lines add up to the number above them — the property
      // `scoring.spec.ts` proves on the real board and cannot prove on CI.
      const values = await cell
        .locator('li ul li')
        .evaluateAll((nodes) =>
          nodes.map((node) => Number(node.textContent?.match(/(\d+)\s*$/)?.[1] ?? 0)),
        );
      expect(values.length).toBeGreaterThan(0);
      expect(values.reduce((sum, value) => sum + value, 0)).toBe(total);
      return total;
    });

    await beat(page, 'The reader’s own roster reports the same figure', async () => {
      expect(await totalInRoster(page, MINE)).toBe(before);
    });

    await beat(page, 'And so does the season leaderboard', async () => {
      expect(await totalOnLeaderboard(page, MINE)).toBe(before);
    });

    await beat(page, 'The film wins its category, and the score moves', async () => {
      await crownWinner(seeded);
    });

    await beat(page, 'All four surfaces moved together', async () => {
      await page.goto(`/leagues/${seeded.leagueId}?year=${YEAR}`);
      const after = await totalOnBoard(page, MINE);
      // 🔴 The relationship, never a number: a nomination earns the category's
      // points and a win earns them a second time (DECISIONS.md), so a win is
      // worth twice a nomination. Asserted this way, re-tiering a category is a
      // decision rather than a red test.
      expect(after).toBe(before * 2);
      expect(await totalInRoster(page, MINE)).toBe(after);

      const standings = page.getByRole('table', { name: /League standings/i });
      const mine = standings.locator('tr[aria-current="true"]');
      expect(Number((await mine.getByRole('cell').last().innerText()).trim())).toBe(
        after,
      );

      expect(await totalOnLeaderboard(page, MINE)).toBe(after);
    });

    await beat(
      page,
      'And the ledger names the win rather than only doubling',
      async () => {
        await page.goto(`/leagues/${seeded.leagueId}?year=${YEAR}`);
        const cell = boardCell(page, MINE);
        await cell.locator('summary').click();
        await expect(cell.getByText('Won')).toBeVisible();
      },
    );
  });
});
