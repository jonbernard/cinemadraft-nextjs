import { expect, type Page, test } from '@playwright/test';

import { signInAs } from '../support/session';
import { beat, DEMO_PACE, startJourney } from './support/pace';
import {
  activeYear,
  assertNoResidue,
  cleanupLeague,
  cleanupUsers,
  withDb,
} from './support/scratch';

/**
 * Journey 1: one person takes a league from nothing to a finished draft.
 *
 * Folds in the P15.T11 league-lifecycle spec, deleted in the same commit, which
 * walked the same path with one group and no ending. Two specs walking the same
 * path diverge the first time either is touched, so there is one — and every
 * assertion the old file carried is inherited here: the creator seated in the
 * same breath, placeholders seating one message at a time, the deal's ceremony,
 * the draft opening, a title fragment being enough to pick with, round 1 giving
 * every seat exactly one turn, round 2 turning back rather than repeating, the
 * public board carrying every pick, and the rows agreeing with the board.
 *
 * What a journey adds over the slices it overlaps: `leagues.spec.ts` proves an
 * invite works, `season-setup.spec.ts` proves seats and groups save,
 * `draft.spec.ts` proves a pick lands. None of them proves the acts *compose*
 * — that the league a person creates is the one the setup page arranges, that
 * the seats it deals are the running order the console reads, that the picks
 * the console takes are the ones the league sees on the public board, and that
 * the whole thing can be brought to an end.
 *
 * 🔴 Scratch everything. League 1 is sixty real people's history and
 * `lib/db.test.ts` counts the restored tables exactly, so the league, its
 * seats, its picks, its films and both identities are created here and removed
 * afterwards — on failure too, which is why the cleanup is in `afterAll`.
 */
const TAG = 'e2e-j1';
const OWNER = `${TAG}-owner@example.test`;
const MEMBER = `${TAG}-member@example.test`;

/**
 * Eight films, as invented words.
 *
 * 🔴 Not `Alpha`/`Bravo`. The restored database holds 1355 films and
 * `findFilms` asks TMDB on every query, so a common fragment competes with
 * real titles for a place in the ranked list and the scratch film can fall off
 * the end. These cannot collide with anything, and searching the whole word is
 * still the "part of the title is enough" path the owner actually uses.
 */
const WORDS = [
  'Zephyrine',
  'Quillon',
  'Bastable',
  'Narrowdale',
  'Pellucid',
  'Thrimble',
  'Vantry',
  'Okenshaw',
];
const FILMS = WORDS.map((word) => `${TAG} ${word}`);

/**
 * Eleven placeholders.
 *
 * With the owner and the member who follows the invite that is thirteen seats,
 * and `dealIntoGroups` is round-robin, so four groups are 4/3/3/3 by
 * construction — never 4/4/3/2. Group 1 is the four, always, because the
 * remainder lands on the groups the walk reaches first.
 */
const PLACEHOLDERS = [
  'Ada',
  'Grace',
  'Katherine',
  'Dorothy',
  'Mary',
  'Annie',
  'Evelyn',
  'Frances',
  'Jean',
  'Kathleen',
  'Marlyn',
];

async function cleanup(): Promise<void> {
  await cleanupLeague(TAG);
  await cleanupUsers(TAG);
}

/** The films the owner drafts from, cached the way a real one would be. */
async function seedFilms(): Promise<void> {
  await withDb(async (query) => {
    for (const title of FILMS) {
      await query(
        `insert into movies (title, sort_title, created_at, updated_at)
           values ($1, $1, now(), now())`,
        [title],
      );
    }
  });
}

/** The seat the board says is up, read from the console's own heading. */
async function onTheClock(page: Page): Promise<string> {
  const heading = page.getByRole('heading', { name: /^Pick for / });
  await expect(heading).toBeVisible();
  return (await heading.innerText()).replace(/^Pick for /, '').trim();
}

/**
 * Take a film for whoever is up, and return the seat it went to.
 *
 * Waits on the console's own status line rather than on a seat name the spec
 * chose: the message is written after the action resolves, so by the time it
 * reads back, the refreshed seats and the next suggestion have arrived as
 * props.
 *
 * The search types the invented word alone, without the tag — a fragment of
 * the title, which is what somebody on a draft call actually says out loud.
 */
async function pick(page: Page, title: string): Promise<string> {
  const seat = await onTheClock(page);

  await page.getByRole('searchbox').fill(title.replace(`${TAG} `, ''));
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await expect(page.getByText(`${title} → ${seat}`)).toBeVisible();

  return seat;
}

/** Every pick in the league, by seat, group and round, as the database has it. */
async function picksInLeague(leagueId: number) {
  return withDb(async (query) =>
    query(
      `select coalesce(d.dummy_name, u.first_name) as seat,
              d."group" as "group", dp."order" as round, m.title
         from draft_picks dp
         join drafts d on d.id = dp.draft_id
         left join users u on u.id = d.user_id
         join movies m on m.id = dp.movie_id
        where d.league_id = $1
        order by d."group", dp."order", dp.id`,
      [leagueId],
    ),
  ) as Promise<{ seat: string; group: number; round: number; title: string }[]>;
}

/** How many seats this league holds, whatever season they are for. */
async function seatCount(leagueId: number): Promise<number> {
  return withDb(async (query) => {
    const rows = (await query(
      'select count(*)::int as count from drafts where league_id = $1',
      [leagueId],
    )) as { count: number }[];
    return rows[0]?.count ?? 0;
  });
}

/** The size of each group, largest first — the dealing rule, checked. */
async function groupSizes(leagueId: number): Promise<number[]> {
  return withDb(async (query) => {
    const rows = (await query(
      `select count(*)::int as count from drafts
        where league_id = $1 and "group" is not null
        group by "group" order by count desc`,
      [leagueId],
    )) as { count: number }[];
    return rows.map((row) => row.count);
  });
}

async function statusOf(leagueId: number): Promise<string | null> {
  return withDb(async (query) => {
    const rows = (await query('select drafting_status from leagues where id = $1', [
      leagueId,
    ])) as { drafting_status: string | null }[];
    return rows[0]?.drafting_status ?? null;
  });
}

test.describe('journey 1 — a season, from nothing to a finished draft', () => {
  // One long test, not eight. A journey's value is that the acts compose;
  // split into tests they would each need the previous one's state seeded,
  // which is the composition being asserted away.
  //
  // 🔴 The budget grows with the pacing. There are roughly forty beats, so a
  // fixed 180s that is ample at `DEMO_PACE=0` fails at `DEMO_PACE=1` — and it
  // would fail as a timeout on whichever beat happened to be last, which reads
  // as a broken app rather than a wrong number.
  test.describe.configure({ timeout: 180_000 + DEMO_PACE * 90_000 });

  test.beforeAll(async () => {
    await cleanup();
    await seedFilms();
  });

  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG);
  });

  test('an owner creates, invites, seats, deals, drafts and finishes', async ({
    page,
    browser,
  }) => {
    const year = await activeYear();
    await startJourney(page);

    await beat(page, 'The owner signs in', async () => {
      await signInAs(page, { email: OWNER, firstName: 'Owner' });
      await page.goto('/leagues');
    });

    const leagueId = await beat(page, 'A new league is created', async () => {
      await page.goto('/leagues/new');
      await page.getByLabel('League name').fill(`${TAG} the picture show`);
      await page.getByRole('button', { name: 'Create league' }).click();
      await expect(page).toHaveURL(/\/leagues\/\d+/);
      await expect(
        page.getByRole('heading', { name: `${TAG} the picture show` }),
      ).toBeVisible();
      return Number(new URL(page.url()).pathname.split('/')[2]);
    });

    // 🔴 The creator is seated in the same breath, or the league is
    // half-created — `leagues.spec.ts`'s first assertion, kept, and read from
    // the rows rather than from the screen because the setup page has not been
    // opened yet.
    await beat(page, 'Creating it seated the creator', async () => {
      expect(await seatCount(leagueId)).toBe(1);
    });

    const invite = await beat(
      page,
      'The invite link is behind a disclosure',
      async () => {
        // 🔴 The uuid is the join credential, so it is not on screen until an
        // owner asks for it (P17.T30). Opening it is part of the journey.
        await page.locator('summary', { hasText: 'Invite' }).click();
        const code = page.locator('code', { hasText: '/join/' });
        await expect(code).toBeVisible();
        const url = (await code.innerText()).trim();
        expect(url).toMatch(/\/join\/[0-9a-f-]{36}$/i);
        return url;
      },
    );

    await beat(page, 'A second person follows the link and joins', async () => {
      const other = await browser.newContext();
      try {
        const otherPage = await other.newPage();
        await signInAs(otherPage, { email: MEMBER, firstName: 'Member' });
        await otherPage.goto(new URL(invite).pathname);
        await otherPage.getByRole('button', { name: 'Join this league' }).click();
        await expect(otherPage).toHaveURL(/\/leagues\/\d+/);
      } finally {
        await other.close();
      }
      // Two seats now: whoever the invite reached really did take one.
      await expect.poll(() => seatCount(leagueId)).toBe(2);
    });

    await beat(page, 'The owner opens the season setup', async () => {
      await page.goto(`/leagues/${leagueId}`);
      // Followed from the league's own page rather than typed as a URL — the
      // link being there for an owner is part of the journey.
      await page.getByRole('link', { name: 'Set up the season' }).click();
      await expect(page).toHaveURL(/\/leagues\/\d+\/setup/);
    });

    // Eleven placeholders, one beat each, so the reel shows the league filling
    // up rather than jumping from two seats to thirteen.
    for (const name of PLACEHOLDERS) {
      await beat(page, `${name} is given a seat`, async () => {
        await page.getByLabel(/without an account/i).fill(name);
        await page.getByRole('button', { name: 'Add seat' }).click();
        await expect(page.getByText(`${name} seated`)).toBeVisible();
      });
    }

    await beat(page, 'Thirteen seats are dealt into four groups', async () => {
      await expect.poll(() => seatCount(leagueId)).toBe(13);
      await page.getByLabel('How many groups').fill('4');
      await page.getByRole('button', { name: 'Deal at random' }).click();
      // 🔴 P15.T12 put a ceremony between the deal and its confirmation. 'Done'
      // rather than 'Skip' is the label once the reel has settled, so waiting
      // for it also waits for the animation.
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText(/dealt into groups/i)).toBeVisible();
      // Round-robin dealing, so thirteen seats into four groups is 4/3/3/3.
      // The sizes are determined even though who landed where is not, so the
      // assertion is on sizes and never on membership.
      expect(await groupSizes(leagueId)).toEqual([4, 3, 3, 3]);
    });

    await beat(page, 'The draft is opened — groups are fixed from here', async () => {
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Start the draft' }).click();
      await expect(page.getByText('The draft is open')).toBeVisible();
    });

    await beat(page, 'The owner opens the draft console', async () => {
      await page.goto(`/leagues/${leagueId}`);
      await page.getByRole('link', { name: 'Run the draft' }).click();
      await expect(page).toHaveURL(/\/leagues\/\d+\/draft/);
      // Four groups, so the console offers a way between them.
      await expect(page.getByRole('navigation', { name: 'Groups' })).toBeVisible();
    });

    // Group 1 holds four seats. Round one gives each of them exactly one turn.
    const roundOne: string[] = [];
    for (const [index, title] of FILMS.slice(0, 4).entries()) {
      const seat = await beat(page, `Round 1, pick ${index + 1}: ${title}`, () =>
        pick(page, title),
      );
      roundOne.push(seat);
    }

    await beat(
      page,
      `Round 1 gave four seats one turn each: ${roundOne.join(', ')}`,
      async () => {
        expect(new Set(roundOne).size).toBe(4);
      },
    );

    await beat(
      page,
      `And round 2 turns back to ${roundOne.at(-1)}, rather than starting again`,
      async () => {
        // 🔴 THE assertion. A draft that ran 1-2-3-4-1 would pass every other
        // check in this file. Read off the console's own answer, never off the
        // order the spec typed the picks in — that would prove only that the
        // spec can count.
        expect(await onTheClock(page)).toBe(roundOne.at(-1));
      },
    );

    for (const [index, title] of FILMS.slice(4, 7).entries()) {
      await beat(
        page,
        `Round 2, pick ${index + 1}: ${title}, for ${roundOne.at(-(index + 1))}`,
        async () => {
          const seat = await pick(page, title);
          // Running back down the order, one seat at a time.
          expect(seat).toBe(roundOne.at(-(index + 1)));
        },
      );
    }

    await beat(page, 'Group 2 drafts too — the console moves between them', async () => {
      await page.getByRole('link', { name: 'Group 2' }).click();
      await expect(page).toHaveURL(/group=2/);
      const seat = await pick(page, FILMS[7] as string);
      // Whoever is up in group 2 is not somebody group 1 already used.
      expect(roundOne).not.toContain(seat);
    });

    await beat(page, 'The league watches the board fill up', async () => {
      await page.goto(`/leagues/${leagueId}`);
      const board = page.getByRole('table', { name: /Draft board/i }).first();
      await expect(board).toBeVisible();
      for (const title of FILMS.slice(0, 7)) {
        await expect(board.getByText(title, { exact: true })).toBeVisible();
      }
    });

    await beat(page, 'And the rows say the same thing the board does', async () => {
      const picks = await picksInLeague(leagueId);
      expect(picks).toHaveLength(8);
      const groupOne = picks.filter((row) => row.group === 1);
      expect(groupOne.map((row) => row.round)).toEqual([1, 1, 1, 1, 2, 2, 2]);
      // The first seat of round 2 is the last seat of round 1 — the snake, in
      // the rows rather than on the screen.
      expect(groupOne.at(4)?.seat).toBe(roundOne.at(-1));
      expect(picks.filter((row) => row.group === 2)).toHaveLength(1);
    });

    await beat(page, 'The owner finishes the draft', async () => {
      // 🔴 P19.T1. Until this phase there was no way to reach this state at
      // all: `completeDraft` existed and nothing called it.
      await page.goto(`/leagues/${leagueId}/setup`);
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: 'Finish the draft' }).click();
      await expect(page.getByText('The draft is finished')).toBeVisible();
    });

    await beat(page, 'And the league board says the season is complete', async () => {
      await page.goto(`/leagues/${leagueId}`);
      // 🔴 The status is the second half of the header's eyebrow — the page
      // renders `${year} · ${status}`, not a bare word, so this asks for what
      // is actually on screen. (The plan expected `complete` alone.)
      await expect(page.getByText(`${year} · complete`)).toBeVisible();
      expect(await statusOf(leagueId)).toBe('complete');
      // A finished season has nobody left to invite, so the standing join
      // credential is gone with it.
      await expect(page.locator('summary', { hasText: 'Invite' })).toHaveCount(0);
    });
  });
});
