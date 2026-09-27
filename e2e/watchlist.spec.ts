import { expect, test } from '@playwright/test';

import {
  activeYear,
  cleanupShow,
  cleanupUsers,
  withDb,
} from './journeys/support/scratch';
import { signInAs } from './support/session';

/**
 * Marking a film watched **from a progress view**.
 *
 * 🔴 The three year-scoped views — `awards`, `nominations`, `drafted` — used to
 * render `SeenChip`, which is read-only and draws nothing at all when the film
 * is unwatched. So the row a reader had a reason to act on was the one row with
 * no control on it, and the only way to mark a nominee seen was to leave for
 * /browse and find it there. A watchlist row *is* the record of having seen a
 * film (D64), so the badge and the button state the same fact.
 *
 * 🔴 **What this proves that the unit test cannot.** `app/(app)/watchlist/
 * page.test.tsx` asserts the wiring against a stubbed action; this asserts the
 * row. A press here travels through the real `setWatched`, which calls
 * `requireUser()` — so the scoping assertion below (the *other* member's list
 * stays empty) is the one that would catch a view that marked films for
 * somebody other than the person pressing.
 *
 * 🔴 No TMDB. `ensureFilm` returns a cached row without asking TMDB when the id
 * is already in `movies`, which is why the scratch film carries one — so this
 * runs on CI like the journeys that need no key.
 *
 * Everything written here carries the tag and is deleted afterwards: the local
 * database is a restored copy of production and `lib/db.test.ts` asserts exact
 * counts for `movies`, `users` and `nominations`.
 */
const TAG = 'e2e-watchlist';
const MEMBER = `${TAG}-member@example.test`;
const OTHER = `${TAG}-other@example.test`;
const FILM = `${TAG} Quillonbury`;
/** Well above the largest id the restored corpus holds (1,713,287). */
const TMDB_ID = '9990101';

async function seed(year: number): Promise<void> {
  await withDb(async (query) => {
    await query(
      `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
         values ($1, $1, $2, now(), now())`,
      [FILM, TMDB_ID],
    );
    await query(
      `insert into events (name, abbreviation, created_at, updated_at)
         values ($1, $2, now(), now())`,
      [`${TAG} Invented Circle`, `${TAG}-SHOW`],
    );
    await query(
      `insert into awards (name, event_id, active, created_at, updated_at)
         select $1, id, true, now(), now() from events where abbreviation = $2`,
      [`${TAG} Best Picture`, `${TAG}-SHOW`],
    );
    await query(
      `insert into nominations (movie_id, award_id, year, created_at, updated_at)
         select m.id, a.id, $1, now(), now()
           from movies m, awards a join events e on e.id = a.event_id
          where m.tmdb_id = $2 and e.abbreviation = $3`,
      [year, TMDB_ID, `${TAG}-SHOW`],
    );
  });
}

async function cleanup(): Promise<void> {
  // Identities and nominations first: both point at the film, and this schema
  // has no foreign keys, so a film deleted first leaves rows nothing complains
  // about and nothing can find.
  await cleanupUsers(TAG);
  await cleanupShow(TAG);
  await withDb(async (query) => {
    await query('delete from movies where title like $1', [`${TAG}%`]);
  });
}

/** How many films this address has marked watched. */
async function watchedCount(email: string): Promise<number> {
  return withDb(async (query) => {
    const rows = (await query(
      `select count(*) from watchlists w
         join users u on u.id = w.user_id
        where u.email = $1`,
      [email],
    )) as { count: string }[];
    return Number(rows[0]?.count ?? 0);
  });
}

test.describe('marking a film watched from a progress view', () => {
  // 🔴 Serial, not the file default. The second test asserts the mark the first
  // one left behind — that "marked in one view, already marked in another" is
  // the whole point — and two workers would race one watchlist row.
  test.describe.configure({ mode: 'serial' });

  let year: number;

  test.beforeAll(async () => {
    await cleanup();
    year = await activeYear();
    await seed(year);
  });

  test.afterAll(async () => {
    await cleanup();
  });

  test('the awards view offers the control, and the press sticks', async ({ page }) => {
    // The second call replaces the first one's cookie, so the browser is the
    // member; OTHER exists only as a row, to have a watchlist that must stay
    // empty.
    await signInAs(page, { email: OTHER, firstName: 'Other' });
    await signInAs(page, { email: MEMBER, firstName: 'Member' });

    await page.goto('/watchlist?view=awards');

    const show = page.locator('details').filter({ hasText: `${TAG} Invented Circle` });
    // 🔴 A closed `<details>` hides its children, so the control cannot be
    // pressed until the show is opened — which is also the reader's real path
    // to it.
    await show.locator('summary').first().click();

    // 🔴 The testid, not the name: the accessible name *changes* when the film
    // is marked, by design, so a name-based handle resolves to a different
    // element after the click. `.first()` because a film nominated in several
    // categories renders one control per row, all of them correct.
    const toggle = show.getByTestId(`watched-toggle-${TMDB_ID}`).first();

    // 🔴 The words, not just the button. A bare glyph was the owner's
    // complaint, and an assertion on the accessible name alone would pass for
    // `sr-only` text nobody can see.
    await expect(toggle).toHaveText('Mark as watched');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();

    // 🔴 The row, not the badge. An optimistic flip proves only that React ran.
    await expect.poll(() => watchedCount(MEMBER)).toBe(1);
    // 🔴 And it is *this* member's row. `setWatched` resolves the user from the
    // session rather than from anything the page sent, and this is the
    // assertion that would notice if that ever stopped being true.
    expect(await watchedCount(OTHER)).toBe(0);

    await page.reload();
    await show.locator('summary').first().click();
    await expect(show.getByTestId(`watched-toggle-${TMDB_ID}`).first()).toHaveText(
      'Watched',
    );
  });

  test('the nominations view undoes it again', async ({ page }) => {
    await signInAs(page, { email: MEMBER, firstName: 'Member' });

    await page.goto('/watchlist?view=nominations');

    const toggle = page.getByTestId(`watched-toggle-${TMDB_ID}`).first();
    // Left marked by the test above — these two share one member deliberately,
    // because "marked in one view, already marked in another" is the behaviour
    // a reader expects and the reason this page revalidates as a whole.
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveText('Watched');

    await toggle.click();

    await expect.poll(() => watchedCount(MEMBER)).toBe(0);
    await page.reload();
    await expect(page.getByTestId(`watched-toggle-${TMDB_ID}`).first()).toHaveText(
      'Mark as watched',
    );
  });
});
