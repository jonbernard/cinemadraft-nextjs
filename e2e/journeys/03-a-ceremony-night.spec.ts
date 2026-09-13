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
 * Journey 3: a ceremony night, from arranging the show to correcting the
 * winner after the wrong name was read out.
 *
 * Folds in the P15.T11 awards-lifecycle spec, deleted in the same commit, which
 * nominated one film through the admin search, crowned it, and asserted that
 * the film page, the league board and the season leaderboard all report the
 * same number and that a win is worth twice a nomination. This is that, plus
 * the show being edited and a category being added before any of it, and the
 * winner being corrected afterwards — a strict superset, so the old file became
 * a shorter second version and is gone.
 *
 * 🔴 **What the product can and cannot do here.** The plan (written
 * 2026-09-12) records that there is no UI for adding a *category*. That is out
 * of date: `components/CategoryCreate.tsx` over `actions/awards/create-category.ts`
 * ships one, and this journey uses it — the category it nominates into is
 * created on screen. What still does not exist is a UI for creating an award
 * **show**: `actions/admin/update-event.ts` is an update and there is no
 * create. So the show is seeded and then *edited*, which is the whole of what
 * the app offers, and this journey does not pretend otherwise.
 *
 * 🔴 **The relationship, never a number.** `DECISIONS.md`: a nomination earns
 * the award's points `P`, a win earns `P` a second time, so a win is worth
 * `2P`. Asserted that way on each surface, a points-table edit is a decision
 * rather than a broken test.
 *
 * 🔴 Scratch everything, on a season of its own — the show, its category, its
 * points tier, two films, the league that drafted them and the year they all
 * belong to. `lib/db.test.ts` asserts the restored database still holds
 * exactly 4,559 nominations and exactly ten seasons.
 *
 * The tag deliberately does not begin `e2e-awards`: that is
 * `e2e/award-shows.spec.ts`'s prefix, its `afterEach` deletes every event and
 * film matching it, and the two files run side by side.
 */
const TAG = 'e2e-j3';
const YEAR = 2993;
const SHOW = `${TAG}-show`;
const ADMIN = `${TAG}-admin@example.test`;
const CATEGORY = `${TAG} Best Picture`;
const TIER = `${TAG}-level`;
const FIRST_FILM = `${TAG} Zephyrine`;
const SECOND_FILM = `${TAG} Quillon`;
const FILMS = [FIRST_FILM, SECOND_FILM];

/**
 * A real TMDB id, on a scratch row.
 *
 * 🔴 The film page is keyed by TMDB id and renders from TMDB — the local row
 * exists only to carry a score — so a made-up id is a 404 and proves nothing.
 * 389 is *12 Angry Men*, which the restored database has never cached, so this
 * row cannot collide with one of the 1,355 real ones.
 */
const TMDB_ID = '389';

const hasTmdb = Boolean(process.env.TMDB_API_KEY);

async function cleanup(): Promise<void> {
  await cleanupShow(TAG);
  await cleanupLeague(TAG);
  await cleanupUsers(TAG);
  await withDb(async (query) => {
    // 🔴 The scratch season goes too. `lib/db.test.ts` asserts
    // `available_years` still holds exactly ten rows.
    await query('delete from available_years where year = $1', [YEAR]);
  });
}

/**
 * A show with no categories, a points tier to give one, two films, and a
 * league that drafted them.
 *
 * The show is seeded because nothing in the app creates one. The **category is
 * not** — adding it is a beat of the journey. The league is seeded for the
 * same reason journey 2's is: journey 1 is the file that proves a league can be
 * built, and building one here would make an unrelated failure look like a
 * scoring one.
 */
async function seed(adminId: number): Promise<{ leagueId: number }> {
  return withDb(async (query) => {
    await query(
      `insert into available_years (year, is_active, created_at, updated_at)
         values ($1, false, now(), now())`,
      [YEAR],
    );

    await query(
      `insert into events (name, abbreviation, created_at, updated_at)
         values ($1, $2, now(), now())`,
      [`${TAG} Show`, SHOW],
    );

    // 🔴 Its own tier rather than one of the real table's. `awards.points` is a
    // foreign key into `points.id` (D41), and CI's seeded-empty database may
    // hold no tiers at all — a category created against "No tier yet" is worth
    // zero, and every assertion below would be `0 === 0 * 2`, which is true and
    // proves nothing.
    await query(
      `insert into points (level, tier, points, created_at, updated_at)
         values ($1, 3, 7, now(), now())`,
      [TIER],
    );

    const movieIds: number[] = [];
    for (const [index, title] of FILMS.entries()) {
      const rows = (await query(
        `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
           values ($1, $1, $2, now(), now()) returning id`,
        // Only the first carries a TMDB id: the film page is the one surface
        // that needs one, and it is only ever asked about the first film.
        [title, index === 0 ? TMDB_ID : null],
      )) as { id: number }[];
      movieIds.push(rows[0]?.id as number);
    }

    const leagues = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), 'complete', now(), now())
       returning id`,
      // Stored the way production stores it: TEXT holding a JSON array.
      [`${TAG} league`, JSON.stringify([adminId])],
    )) as { id: number }[];
    const leagueId = leagues[0]?.id as number;

    // 🔴 Two seats, one film each. One seat holding both would make the
    // correction beat unreadable: the seat's total would not move, because
    // what the correction does is take points off one film and give them to
    // another.
    for (const [index, movieId] of movieIds.entries()) {
      const seats = (await query(
        `insert into drafts (league_id, year, "group", "order", dummy, dummy_name,
                             created_at, updated_at)
           values ($1, $2, 1, $3, true, $4, now(), now()) returning id`,
        [leagueId, YEAR, index + 1, ['Ada', 'Grace'][index]],
      )) as { id: number }[];
      await query(
        `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
           values ($1, $2, 1, now(), now())`,
        [seats[0]?.id, movieId],
      );
    }

    return { leagueId };
  });
}

/** The nominations and winners this show holds, by title — the rows, not the screen. */
async function stateOfShow() {
  return withDb(async (query) => {
    const nominations = (await query(
      `select m.title from nominations n
         join movies m on m.id = n.movie_id
         join awards a on a.id = n.award_id
         join events e on e.id = a.event_id
        where e.abbreviation = $1 order by m.title`,
      [SHOW],
    )) as { title: string }[];
    const winners = (await query(
      `select m.title from winners w
         join movies m on m.id = w.movie_id
         join awards a on a.id = w.award_id
         join events e on e.id = a.event_id
        where e.abbreviation = $1 order by m.title`,
      [SHOW],
    )) as { title: string }[];
    return {
      nominations: nominations.map((row) => row.title),
      winners: winners.map((row) => row.title),
    };
  });
}

/** The headline total on the film's own page. */
async function pointsOnFilmPage(page: Page): Promise<number> {
  await page.goto(`/films/${TMDB_ID}`);
  const value = page
    .getByText(`Total, ${YEAR} season`, { exact: true })
    .locator('xpath=following-sibling::span[1]');
  await expect(value).toBeVisible();
  return Number((await value.innerText()).trim());
}

/**
 * A film's cell on the league board.
 *
 * Read off the ledger's summary, which is the number a member actually sees on
 * the board — `film.points` renders nowhere else in the cell. Scoped to the
 * desktop grid: the board renders both presentations (D49) and CSS hides one,
 * so an unscoped match finds the phone copy as well.
 */
async function pointsOnLeagueBoard(
  page: Page,
  leagueId: number,
  title: string,
): Promise<number> {
  await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
  const summary = page
    .getByRole('table', { name: /Draft board/i })
    .first()
    .locator('figure')
    .filter({ hasText: title })
    .locator('summary');
  await expect(summary).toBeVisible();
  return Number((await summary.innerText()).match(/\d+/)?.[0] ?? Number.NaN);
}

/** The Total column of the season leaderboard, on the dashboard. */
async function pointsOnLeaderboard(page: Page, title: string): Promise<number> {
  await page.goto(`/?year=${YEAR}`);
  // The film is the row header; the last real cell is Total, whatever the
  // season's shows are.
  const total = page.getByRole('row').filter({ hasText: title }).getByRole('cell').last();
  await expect(total).toBeVisible();
  return Number((await total.innerText()).trim());
}

test.describe('journey 3 — a ceremony night', () => {
  // 🔴 The budget grows with the pacing: a fixed number ample at `DEMO_PACE=0`
  // fails at `DEMO_PACE=1` as a timeout on whichever beat happened to be last.
  test.describe.configure({ timeout: 150_000 + DEMO_PACE * 60_000 });

  test.beforeAll(cleanup);

  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG, [YEAR]);
  });

  test('an admin arranges a show, nominates, crowns, and corrects the winner', async ({
    page,
  }) => {
    await startJourney(page);

    const adminId = await signInAs(page, { email: ADMIN, firstName: 'Admin' });
    await withDb(async (query) => {
      await query("update users set role = 'admin' where id = $1", [adminId]);
    });
    const { leagueId } = await seed(adminId);

    await beat(page, 'The admin finds the show on the index', async () => {
      await page.goto('/award-shows');
      await page
        .getByRole('link', { name: new RegExp(`${TAG} Show`) })
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/award-shows/${SHOW}`));
    });

    await beat(page, 'And moves to the season being entered', async () => {
      // The index links to the active season; the season rail is how an admin
      // reaches the one whose ceremony is tonight.
      await page
        .getByRole('navigation', { name: 'Seasons' })
        .getByRole('link', { name: String(YEAR) })
        .click();
      await expect(page).toHaveURL(new RegExp(`year=${YEAR}`));
      await expect(page.getByText('No categories yet')).toBeVisible();
    });

    await beat(page, 'The show is renamed, and given a ceremony date', async () => {
      // The one editing surface that exists: `components/EventAdmin.tsx`.
      await page.getByLabel('Name', { exact: true }).fill(`${TAG} Show of Shows`);
      // 🔴 Scoped to the Awards fieldset. "Announced" is the label of *two*
      // fields on this form — nominations and awards — so an unscoped
      // `getByLabel` is ambiguous and fails the locator, not the assertion.
      await page
        .getByRole('group', { name: 'Awards' })
        .getByLabel('Announced')
        .fill(`${YEAR}-03-14T20:00`);
      await page.getByRole('button', { name: 'Save show' }).click();
      await expect(page.getByText('Saved')).toBeVisible();

      await page.reload();
      await expect(
        page.getByRole('heading', { name: `${TAG} Show of Shows` }),
      ).toBeVisible();
    });

    await beat(page, 'A category is added, worth seven points', async () => {
      await page.getByLabel('New category').fill(CATEGORY);
      // The tier is chosen from the real points table, never typed: the column
      // is a foreign key, so a typed number would attach the wrong tier (D41).
      await page.getByLabel('Worth').selectOption({ label: `${TIER} · 7 pts` });
      await page.getByRole('button', { name: 'Add category' }).click();
      await expect(page.getByText(`${CATEGORY} added`)).toBeVisible();

      // It is a section of the show now, with what it is worth beside it.
      await expect(page.getByRole('heading', { name: CATEGORY })).toBeVisible();
      // Exact: the tier `<select>` still on the page holds an option reading
      // `${TIER} · 7 pts`, and a substring match finds both.
      await expect(page.getByText('7 pts', { exact: true })).toBeVisible();
      await expect(page.getByText('No winner yet')).toBeVisible();
    });

    await beat(page, 'Both contenders are nominated, by searching', async () => {
      // A fragment of the title is enough (§10) — the path an admin uses on a
      // nominations morning, one name at a time as they are read out.
      for (const title of FILMS) {
        await page.getByRole('searchbox').fill(title.replace(`${TAG} `, ''));
        await page
          .getByRole('button', { name: new RegExp(title) })
          .first()
          .click();
        await expect(page.getByText(`${title} nominated`)).toBeVisible();
      }
      expect((await stateOfShow()).nominations).toEqual([...FILMS].sort());
    });

    const nominated = await beat(
      page,
      'What a nomination is worth, everywhere',
      async () => {
        const values = {
          board: await pointsOnLeagueBoard(page, leagueId, FIRST_FILM),
          leaderboard: await pointsOnLeaderboard(page, FIRST_FILM),
          film: hasTmdb ? await pointsOnFilmPage(page) : null,
        };
        expect(values.board).toBeGreaterThan(0);
        // 🔴 Three services, one scoring rule (D41). Disagreement here is the
        // defect this journey exists to catch. The film page needs TMDB and is
        // skipped without it — visibly, by being null, never by being dropped.
        expect(values.leaderboard).toBe(values.board);
        if (values.film != null) expect(values.film).toBe(values.board);
        return values;
      },
    );

    await beat(page, 'The envelope is opened — the first film wins', async () => {
      await page.goto(`/award-shows/${SHOW}?year=${YEAR}`);
      await page
        .getByRole('listitem')
        .filter({ hasText: FIRST_FILM })
        .getByRole('button', { name: 'Mark winner' })
        .click();
      await expect.poll(async () => (await stateOfShow()).winners).toEqual([FIRST_FILM]);
    });

    await beat(page, 'A win is worth twice a nomination, on all three', async () => {
      expect(await pointsOnLeagueBoard(page, leagueId, FIRST_FILM)).toBe(
        nominated.board * 2,
      );
      expect(await pointsOnLeaderboard(page, FIRST_FILM)).toBe(nominated.leaderboard * 2);
      if (nominated.film != null) {
        expect(await pointsOnFilmPage(page)).toBe(nominated.film * 2);
      }
    });

    await beat(
      page,
      'And the board names the win rather than only doubling',
      async () => {
        // A reader has to be able to see *why* the number moved.
        await page.goto(`/leagues/${leagueId}?year=${YEAR}`);
        const cell = page
          .getByRole('table', { name: /Draft board/i })
          .first()
          .locator('figure')
          .filter({ hasText: FIRST_FILM });
        await cell.locator('summary').click();
        await expect(cell.getByText('Won')).toBeVisible();
      },
    );

    await beat(
      page,
      'The wrong name was read out — the winner is corrected',
      async () => {
        // 🔴 The ordinary case during a live ceremony (§12): the old winner is
        // replaced, not joined by a second one.
        await page.goto(`/award-shows/${SHOW}?year=${YEAR}`);
        await page
          .getByRole('listitem')
          .filter({ hasText: SECOND_FILM })
          .getByRole('button', { name: 'Mark winner' })
          .click();
        await expect
          .poll(async () => (await stateOfShow()).winners)
          .toEqual([SECOND_FILM]);
      },
    );

    await beat(page, 'And the points followed the correction', async () => {
      // The first film is back to a nomination's worth; the second carries the
      // win. Both stated as the relationship, never as 7 and 14.
      expect(await pointsOnLeagueBoard(page, leagueId, FIRST_FILM)).toBe(nominated.board);
      expect(await pointsOnLeagueBoard(page, leagueId, SECOND_FILM)).toBe(
        nominated.board * 2,
      );
      expect(await pointsOnLeaderboard(page, SECOND_FILM)).toBe(nominated.board * 2);
    });
  });
});
