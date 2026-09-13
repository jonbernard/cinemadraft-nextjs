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
 * Journey 6: a ceremony as it happens — the screen a league puts on a
 * television while the envelopes are being opened, and what it does when a
 * winner is marked.
 *
 * The three surfaces it walks, in the order the night uses them:
 *   1. `/live/[abbr]` before anything is decided, read by a **stranger** with
 *      no account — every category as its nominees' posters, the countdown,
 *      the Live chip, and the invitation that stands in for a league;
 *   2. the same URL with `?league=<id>`, which is how the link is shared: one
 *      league's standings down the right and its rosters below, and no claim
 *      about who is reading;
 *   3. the admin marking a winner on `/award-shows/[abbr]`, and the ceremony
 *      page carrying it — the seal, the counter, and the standings moving.
 *
 * 🔴 **What this journey CANNOT show, and does not pretend to.** The reveal —
 * the wash, the mark landing, the losers receding — is `LiveAward`'s `reveal`
 * prop, and it is **off by default on purpose**: a reload of a finished
 * ceremony would otherwise replay every category's reveal at once. The client
 * that turns it on for the one category whose winner arrived while the page
 * was open is P14.T4, and P14.T4 is not built. There is therefore no code path
 * in the application that sets `reveal`, and the only way to film the
 * animation today would be to hand the prop in by hand and present a Storybook
 * state as the live behaviour — which would be a lie told in a recording the
 * owner reviews. So the last beat asserts the opposite and true thing: that a
 * reload of a decided category is **still**. That assertion is what goes red
 * the day P14.T4 lands or the default flips, which is exactly when somebody
 * should be looking at this file.
 *
 * 🔴 **Nothing advances on its own, and that is the product today.** The page
 * renders the state at request time (D23 stays deferred; `lib/services/live.ts`
 * says so in its own header). The journey reloads, because a reload is what the
 * room does.
 *
 * 🔴 Scratch everything, on a season of its own: the show, three categories,
 * two points tiers, four films, seven nominations, the league that drafted two
 * of the films, and the admin identity. `lib/db.test.ts` counts the restored
 * tables exactly — 4,559 nominations, ten seasons, 1,355 films, 60 users.
 *
 * The tag deliberately does not begin `e2e-live`: that is `e2e/live.spec.ts`'s
 * prefix, its `afterEach` deletes every event, film and league matching it, and
 * the two files run side by side.
 */
const TAG = 'e2e-j6';
const YEAR = 2994;
const SHOW = `${TAG}-show`;
const ADMIN = `${TAG}-admin@example.test`;

const HEADLINE = `${TAG} Best Picture`;
const CRAFT_ONE = `${TAG} Best Director`;
const CRAFT_TWO = `${TAG} Best Sound`;

/**
 * Two tiers, not one, and the difference is load-bearing.
 *
 * A single tier would make every seat's total a multiple of the same number,
 * and the overtake this journey turns on — the seat holding the headline
 * winner going past the seat with more nominations — could not happen. The
 * figures are never asserted: every claim below is a relationship (D41 — a win
 * is worth the category twice, because a winner was nominated), so editing the
 * points table stays a decision rather than a broken test.
 */
const HEADLINE_TIER = `${TAG}-headline`;
const CRAFT_TIER = `${TAG}-craft`;

const FILMS = ['Zephyrine', 'Quillon', 'Bastable', 'Narrowdale'].map(
  (word) => `${TAG} ${word}`,
);
/** The film the envelope names. Nominated once, so its row on the admin page is unique. */
const WINNER = FILMS[0] as string;
/** The film that leads on nominations and is overtaken by the win. */
const RIVAL = FILMS[1] as string;

/** The seat holding the winner, and the seat holding the rival. */
const SEATS = { winner: 'Ada', rival: 'Grace' } as const;

/** UTC midnight, thirty days out, so the countdown always has days to show. */
function futureMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30);
}

async function cleanup(): Promise<void> {
  // Shows first: `winners` and `nominations` point at the films `cleanupLeague`
  // removes.
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
 * A show on air, three categories, four films, seven nominations, and a league
 * with two seats that drafted two of the films.
 *
 * The show is seeded because nothing in the app creates one — journey 3 records
 * the same gap and edits rather than creates. The categories are seeded here
 * rather than added on screen for the same reason journey 6 is not journey 3:
 * arranging a show is journey 3's subject, and rebuilding it here would make an
 * unrelated failure look like a broadcast one.
 *
 * 🔴 Every insert that has to match two rows is done in SQL. This schema mixes
 * integer and bigint primary keys, so `pg` hands some ids back as numbers and
 * some as strings, and `===` between them silently finds nothing — which is how
 * `live.spec.ts`'s first seed wrote a winner row with a null `movie_id`.
 */
async function seed(): Promise<{ leagueId: number }> {
  return withDb(async (query) => {
    await query(
      `insert into available_years (year, is_active, created_at, updated_at)
         values ($1, false, now(), now())`,
      [YEAR],
    );

    // `awards_active` is what the page reads as "on air"; `awards_date` plus
    // `awards_time` is what the countdown counts to.
    const events = (await query(
      `insert into events (name, abbreviation, awards_active, awards_date, awards_time,
                           created_at, updated_at)
         values ($1, $2, true, $3, $4, now(), now()) returning id`,
      [`${TAG} Show`, SHOW, futureMidnight(), 60 * 60 * 1000],
    )) as { id: number }[];
    const eventId = events[0]?.id as number;

    // 🔴 Its own tiers rather than the real table's. `awards.points` is a
    // foreign key into `points.id` (D41), and CI's seeded-empty database holds
    // no tiers at all — categories created against nothing are worth zero, and
    // every assertion below would be `0 === 0 * 2`, which is true and proves
    // nothing.
    const tiers = (await query(
      `insert into points (level, tier, points, created_at, updated_at)
         values ($1, 1, 20, now(), now()), ($2, 3, 5, now(), now())
       returning id, level`,
      [HEADLINE_TIER, CRAFT_TIER],
    )) as { id: number; level: string }[];
    const tierId = (level: string) => tiers.find((row) => row.level === level)?.id;

    await query(
      `insert into awards (name, event_id, points, created_at, updated_at)
         values ($1, $4, $5, now(), now()),
                ($2, $4, $6, now(), now()),
                ($3, $4, $6, now(), now())`,
      [
        HEADLINE,
        CRAFT_ONE,
        CRAFT_TWO,
        eventId,
        tierId(HEADLINE_TIER),
        tierId(CRAFT_TIER),
      ],
    );

    for (const title of FILMS) {
      await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now())`,
        [title],
      );
    }

    // Seven nominations across three categories, so no category is a single
    // poster and the headline is the widest row. The winner is nominated
    // ONCE — which is what makes its row on the admin page unambiguous, and
    // what makes the overtake below arithmetic rather than luck.
    const ballot: [string, string[]][] = [
      [HEADLINE, [FILMS[0], FILMS[1], FILMS[2]] as string[]],
      [CRAFT_ONE, [FILMS[1], FILMS[3]] as string[]],
      [CRAFT_TWO, [FILMS[2], FILMS[3]] as string[]],
    ];
    for (const [category, titles] of ballot) {
      for (const title of titles) {
        await query(
          `insert into nominations (movie_id, award_id, year, created_at, updated_at)
             select m.id, a.id, $1, now(), now()
               from movies m
               cross join awards a
               join events e on e.id = a.event_id
              where m.title = $2 and a.name = $3 and e.abbreviation = $4`,
          [YEAR, title, category, SHOW],
        );
      }
    }

    const leagues = (await query(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), 'complete', now(), now())
       returning id`,
      // Stored the way production stores it: TEXT holding a JSON array. The
      // admin owns it but holds no seat, so nothing on this page is ever
      // "your seat" — which keeps the pinned view identical before and after
      // they sign in, and is what makes the `?league=` beat about the link
      // rather than about the reader.
      [`${TAG} league`, JSON.stringify([])],
    )) as { id: number }[];
    const leagueId = leagues[0]?.id as number;

    for (const [index, [name, title]] of [
      [SEATS.winner, WINNER],
      [SEATS.rival, RIVAL],
    ].entries()) {
      const seats = (await query(
        `insert into drafts (league_id, year, "group", "order", dummy, dummy_name,
                             created_at, updated_at)
           values ($1, $2, 1, $3, true, $4, now(), now()) returning id`,
        [leagueId, YEAR, index + 1, name],
      )) as { id: number }[];
      await query(
        `insert into draft_picks (draft_id, movie_id, "order", created_at, updated_at)
           select $1, id, 1, now(), now() from movies where title = $2`,
        [seats[0]?.id, title],
      );
    }

    return { leagueId };
  });
}

/** The films this show has crowned, by title — the rows, not the screen. */
async function winners(): Promise<string[]> {
  return withDb(async (query) => {
    const rows = (await query(
      `select m.title from winners w
         join movies m on m.id = w.movie_id
         join awards a on a.id = w.award_id
         join events e on e.id = a.event_id
        where e.abbreviation = $1 order by m.title`,
      [SHOW],
    )) as { title: string }[];
    return rows.map((row) => row.title);
  });
}

/**
 * One category's block on the live page.
 *
 * The categories are an `<ol>` of `<li>`, and each one holds a `<ul>` of its
 * nominees — so "the list item that contains this heading" is the category and
 * the list items inside it are its posters. A plain text match would also
 * catch the category headings, which carry the same scratch prefix.
 */
function category(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
}

/** One seat's line in the standings table: where it sits, and on how many points. */
async function standing(
  page: Page,
  seat: string,
): Promise<{ position: string; total: number }> {
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: new RegExp(seat) }) });
  await expect(row).toBeVisible();
  const cells = row.getByRole('cell');
  return {
    position: (await cells.first().innerText()).trim(),
    total: Number((await cells.last().innerText()).trim()),
  };
}

test.describe('journey 6 — a ceremony as it happens', () => {
  // 🔴 The budget grows with the pacing: a fixed number ample at `DEMO_PACE=0`
  // fails at `DEMO_PACE=1` as a timeout on whichever beat happened to be last.
  test.describe.configure({ timeout: 150_000 + DEMO_PACE * 60_000 });

  test.beforeAll(cleanup);

  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG, [YEAR]);
  });

  test('a winner is marked, and the ceremony screen carries it', async ({ page }) => {
    await startJourney(page);
    const { leagueId } = await seed();
    const live = `/live/${SHOW}?year=${YEAR}`;
    const pinned = `${live}&league=${leagueId}`;

    await beat(page, 'A stranger opens the ceremony, with no account', async () => {
      const response = await page.goto(live);
      // Public by the owner's ruling, amending D40 — a stranger handed the link
      // during a show has to be able to watch. A redirect to the login page
      // would answer 200 as well, so the path is checked too.
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(`/live/${SHOW}`);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(`${TAG} Show`);
    });

    await beat(page, 'It is on air, and the clock is running', async () => {
      await expect(page.getByText('Live', { exact: true })).toBeVisible();
      // The <time> is server-rendered; the relative string arrives after mount.
      await expect(page.locator('time')).toBeVisible();
      await expect(page.getByText(/\d+d \d\d:\d\d:\d\d/)).toBeVisible();
    });

    await beat(page, 'Every category is its nominees’ posters', async () => {
      // 🔴 Posters, not a chip counting them (P14.T1): the artwork is what is
      // readable from a sofa, and a page that had gone back to one chip per
      // category would have nothing to count here at all. Counted per
      // category rather than in total, so a page that rendered the same
      // nominees three times would still fail.
      for (const [name, nominees] of [
        [HEADLINE, 3],
        [CRAFT_ONE, 2],
        [CRAFT_TWO, 2],
      ] as const) {
        await expect(category(page, name).getByRole('listitem')).toHaveCount(nominees);
      }
      // Nothing is decided, and the counter says so rather than the posters.
      await expect(page.getByText('0 of 3')).toBeVisible();
      await expect(page.getByText('Winner', { exact: true })).toHaveCount(0);
    });

    await beat(page, 'And a stranger is invited in, not shown a league', async () => {
      // `/leagues` is protected, so offering "Find a league" to somebody with
      // no account is a link to a login page wearing a league's name.
      await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Find a league' })).toHaveCount(0);
      await expect(page.getByRole('rowheader')).toHaveCount(0);
    });

    const before = await beat(
      page,
      'The link is shared with one league pinned to it',
      async () => {
        await page.goto(pinned);
        // The standings sit down the right — the same `StandingsPanel` the
        // league page renders, from the same board.
        const seats = await Promise.all([
          standing(page, SEATS.winner),
          standing(page, SEATS.rival),
        ]);
        // 🔴 And nothing claims a seat for a reader who holds none. A dummy
        // seat's `userId` is null, so an `isViewer` written without the
        // session check marks every placeholder as the reader's own — on a
        // page anybody can open.
        await expect(page.getByText('Your seat', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Rosters' })).toBeVisible();
        return { winner: seats[0], rival: seats[1] };
      },
    );

    await beat(page, 'The rival leads, on nominations alone', async () => {
      // Stated as the relationship, never as 20 and 25: the points table is a
      // decision, and a journey that hardcoded it would go red for an edit
      // rather than for a defect.
      expect(before.rival.total).toBeGreaterThan(before.winner.total);
      expect(Number(before.rival.position)).toBeLessThan(Number(before.winner.position));
    });

    await beat(page, 'An admin takes the envelope backstage', async () => {
      const adminId = await signInAs(page, { email: ADMIN, firstName: 'Admin' });
      await withDb(async (query) => {
        await query("update users set role = 'admin' where id = $1", [adminId]);
      });
      await page.goto(`/award-shows/${SHOW}?year=${YEAR}`);
      await expect(page.getByText('No winner yet')).toHaveCount(3);
    });

    await beat(page, `And marks the winner — ${WINNER}`, async () => {
      await page
        .getByRole('listitem')
        .filter({ hasText: WINNER })
        .getByRole('button', { name: 'Mark winner' })
        .click();
      await expect.poll(winners).toEqual([WINNER]);
    });

    await beat(page, 'The ceremony screen carries it', async () => {
      // 🔴 A reload, because that is the product today: the page renders the
      // state at request time and nothing advances on its own (D23 deferred).
      await page.goto(pinned);
      await expect(page.getByText('1 of 3')).toBeVisible();
      // The word, not the mark: the seal is `aria-hidden` brass, and the word
      // beside it is what a screen reader hears and what survives a
      // monochrome projector.
      await expect(page.getByText('Winner', { exact: true })).toHaveCount(1);
      const sealed = page.getByTestId('live-winner');
      await expect(sealed).toContainText(WINNER);
      await expect(sealed).not.toContainText(RIVAL);
      // And on the seat's own copy of the film, down in the rosters.
      await expect(page.getByRole('img', { name: 'Winner' })).toHaveCount(1);
    });

    await beat(page, 'And the standings moved under it', async () => {
      const after = {
        winner: await standing(page, SEATS.winner),
        rival: await standing(page, SEATS.rival),
      };
      // D41: a win earns the category's points a second time, so a seat whose
      // only film won its only category doubles.
      expect(after.winner.total).toBe(before.winner.total * 2);
      // The rival was not in that category and has not moved.
      expect(after.rival.total).toBe(before.rival.total);
      // Which is the overtake: the seat that was behind is now in front.
      expect(after.winner.total).toBeGreaterThan(after.rival.total);
      expect(Number(after.winner.position)).toBeLessThan(Number(after.rival.position));
    });

    await beat(page, 'A finished ceremony reloads still, never replaying', async () => {
      // 🔴 The honest half of "show the reveal". `LiveAward`'s `reveal` is off
      // by default and nothing in the application turns it on yet (P14.T4), so
      // what this journey can prove is the invariant that default exists for:
      // reloading a decided category must not replay the reveal, or a room
      // that refreshed at the end of the night would watch every envelope open
      // again at once.
      //
      // Asserted on the computed animation rather than on a class name: the
      // class is what the code says, this is what the browser is doing.
      await page.reload();
      const running = await page
        .getByTestId('live-winner')
        .evaluate((node) =>
          [node, ...node.querySelectorAll('*')]
            .map((element) => getComputedStyle(element).animationName)
            .filter((name) => name !== 'none'),
        );
      expect(running).toEqual([]);
    });
  });
});
