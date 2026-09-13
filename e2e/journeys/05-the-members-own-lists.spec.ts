import { expect, type Locator, type Page, test } from '@playwright/test';

import { signInAs } from '../support/session';
import { beat, DEMO_PACE, startJourney } from './support/pace';
import { assertNoResidue, cleanupUsers, withDb } from './support/scratch';

/**
 * Journey 5: the two pages that belong to one member and nobody else — the
 * draft list they prepare before a draft, and the watchlist of what they have
 * actually seen.
 *
 * **First browser coverage of either.** Grep `e2e/`: the only existing mention
 * is `nav.spec.ts` asserting the More sheet's links point at `/list` and
 * `/watchlist`. Nothing had ever opened them.
 *
 * 🔴 **No TMDB needed, deliberately.** Both pages read local `movies` rows; the
 * draft list's typeahead is `findFilmsAction`, which answers from the local
 * table and absorbs a TMDB failure rather than propagating it; and unmarking a
 * film goes through `ensureFilm`, which returns a cached row **without asking
 * TMDB at all** when the id is already in `movies` — which is why the scratch
 * films below carry TMDB ids. The one path that genuinely needs a key —
 * marking a film watched from `/browse` — is `browse.spec.ts`'s and journey
 * 4's; this journey marks from the database and unmarks from the page, and
 * therefore runs on CI like journeys 1, 2, 3 and 6.
 *
 * Both pages are scoped to the **active** season with no `?year=` override
 * (`app/(app)/list/page.tsx` and `app/(app)/watchlist/page.tsx` both call
 * `getActiveYear()` and neither reads a year param), so this journey registers
 * no season of its own and touches `available_years` not at all.
 *
 * 🔴 Scratch everything: four films, one throwaway identity, and the `lists`
 * and `watchlists` rows hanging off it. `lib/db.test.ts` asserts the restored
 * database still holds exactly 1,355 films and 60 users.
 */
const TAG = 'e2e-j5';
const MEMBER = `${TAG}-member@example.test`;
const WORDS = ['Zephyrine', 'Quillon', 'Bastable', 'Narrowdale'];
const FILMS = WORDS.map((word) => `${TAG} ${word}`);

/**
 * A TMDB id per scratch film, and none of them is a film.
 *
 * 🔴 The watchlist only renders its toggle for a row that has one
 * (`app/(app)/watchlist/page.tsx`: `film.tmdbId ? <WatchedToggle …>`), so
 * without these the "undo the badge" beat would have nothing to press — and
 * `setWatched` takes a TMDB id rather than a local one. Seven digits above the
 * largest id the restored corpus holds (1,713,287), so a scratch row can never
 * collide with one of the 1,355 real ones, and `ensureFilm` finds it locally
 * and never asks TMDB about it.
 */
const TMDB_IDS = ['9990001', '9990002', '9990003', '9990004'];

async function seedFilms(): Promise<void> {
  await withDb(async (query) => {
    for (const [index, title] of FILMS.entries()) {
      await query(
        `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
           values ($1, $1, $2, now(), now())`,
        [title, TMDB_IDS[index]],
      );
    }
  });
}

async function cleanup(): Promise<void> {
  // Identities first: `cleanupUsers` deletes the `lists` and `watchlists` rows
  // that point at the films, and a film deleted first leaves them dangling —
  // this schema has no foreign keys, so nothing would complain.
  await cleanupUsers(TAG);
  await withDb(async (query) => {
    await query('delete from movies where title like $1', [`${TAG}%`]);
  });
}

/** The member's draft list, as rows rather than as a screen. */
async function listRows(): Promise<{ title: string; status: string }[]> {
  return withDb(async (query) =>
    query(
      `select m.title, l.status from lists l
         join users u on u.id = l.user_id
         join movies m on m.id = l.movie_id
        where u.email = $1
        order by l."order"`,
      [MEMBER],
    ),
  ) as Promise<{ title: string; status: string }[]>;
}

/** How many films this member has marked watched. */
async function watchedCount(): Promise<number> {
  return withDb(async (query) => {
    const rows = (await query(
      `select count(*) from watchlists w
         join users u on u.id = w.user_id
        where u.email = $1`,
      [MEMBER],
    )) as { count: string }[];
    return Number(rows[0]?.count ?? 0);
  });
}

/**
 * Mark a film watched in the database rather than through a page.
 *
 * The watchlist page lists what is already marked and offers only the undo —
 * marking is done from `/browse` or a film page, both of which are TMDB's and
 * both of which `browse.spec.ts` and journey 4 already walk. So the row is
 * seeded and the *undo* is the beat, which is the half no test has ever
 * pressed.
 *
 * 🔴 `watchlists.movie_id` is **bigint** while `movies.id` is integer —
 * `lib/db.test.ts` records that inconsistency explicitly — so the insert is
 * pure SQL and no id is matched in JavaScript, where `pg` hands one back as a
 * string and the other as a number and `===` silently finds nothing.
 */
async function markWatched(userId: number, title: string): Promise<void> {
  await withDb(async (query) => {
    await query(
      `insert into watchlists (user_id, movie_id, created_at, updated_at)
         select $1, id, now(), now() from movies where title = $2`,
      [userId, title],
    );
  });
}

/**
 * Drag one row of a reorderable list onto another, with a real pointer.
 *
 * 🔴 The press must land on the **drag handle** — `@hello-pangea/dnd` puts its
 * own attribute on whatever carries `handleProps`, and `DraftListEditor`
 * spreads them on the inner div rather than on the `<li>`, so a press aimed at
 * the list item starts no drag at all. And the first move has to clear the
 * library's 5px sloppy-click threshold before the real one, or the gesture is
 * read as a click.
 *
 * This is the thing jsdom cannot do: every element box measures zero there, so
 * the library refuses to lift.
 */
async function dragOnto(page: Page, handle: Locator, target: Locator): Promise<void> {
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('a row in the drag has no box');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Past the sloppy-click threshold first, then to the far edge of the target
  // row — dropping on its near edge lands back where the drag started.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, {
    steps: 4,
  });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height, { steps: 12 });
  await page.mouse.up();
}

test.describe('journey 5 — the member’s own lists', () => {
  test.describe.configure({ timeout: 150_000 + DEMO_PACE * 60_000 });

  test.beforeAll(async () => {
    await cleanup();
    await seedFilms();
  });

  test.afterAll(async () => {
    await cleanup();
    await assertNoResidue(TAG);
  });

  test('a member prepares a draft list and keeps a watchlist', async ({ page }) => {
    await startJourney(page);
    const memberId = await signInAs(page, { email: MEMBER, firstName: 'Member' });

    const list = page.getByRole('list', { name: /Your list, best first/ });
    const rows = list.getByRole('listitem');

    await beat(page, 'The draft list starts empty', async () => {
      await page.goto('/list');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Draft list' }),
      ).toBeVisible();
      await expect(page.getByText('Nothing on your list yet')).toBeVisible();
      // 🔴 Only you ever see this — the eyebrow says so, because a shortlist
      // somebody else can read is not a shortlist.
      await expect(page.getByText(/only you can see this/i)).toBeVisible();
    });

    await beat(page, 'Four films go on the list, one search at a time', async () => {
      // A fragment of the title is enough (§10) — the invented word, not the
      // tag, so the ranked list is not competing with the other journeys'
      // scratch rows.
      const field = page.getByRole('searchbox', { name: 'Add a film' });
      for (const [index, title] of FILMS.entries()) {
        await field.fill(WORDS[index] as string);
        await page
          .getByRole('button', { name: new RegExp(title) })
          .first()
          .click();
        await expect(list.getByText(title, { exact: true })).toBeVisible();
      }
    });

    await beat(page, 'Four films, in the order they were added', async () => {
      expect((await listRows()).map((row) => row.title)).toEqual(FILMS);
    });

    await beat(page, 'The second is dragged above the first', async () => {
      await dragOnto(
        page,
        rows.nth(1).locator('[data-rfd-drag-handle-draggable-id]'),
        rows.first(),
      );
      await expect(rows.first()).toContainText(FILMS[1] as string);
    });

    await beat(page, 'And the new order came back from the server', async () => {
      await page.reload();
      expect((await listRows()).map((row) => row.title)[0]).toBe(FILMS[1]);
      await expect(rows.first()).toContainText(FILMS[1] as string);
    });

    await beat(page, 'A film is marked as gone to somebody else', async () => {
      // The value, not the label: `STATUSES` is the closed union
      // `DraftListEditor` writes, and a label is copy that can be reworded.
      const marked = rows.filter({ hasText: FILMS[2] as string });
      await marked.getByRole('combobox').selectOption('unavailable');
      await expect
        .poll(
          async () => (await listRows()).find((row) => row.title === FILMS[2])?.status,
        )
        .toBe('unavailable');
      // 🔴 And the row says so out loud. Scoped to a `span` with exactly that
      // text: the `<select>` that set it holds an `<option>` reading the same
      // words on every row, so an unscoped `getByText` resolves to five
      // elements and fails as a locator rather than as an assertion.
      await expect(
        marked.locator('span').filter({ hasText: /^Someone else took it$/ }),
      ).toBeVisible();
      // The page now says how much of the list is still live — and only once
      // something has been marked, which is why this could not be asserted
      // before the beat above.
      await expect(page.getByText(/still on the board/i)).toBeVisible();
    });

    await beat(page, 'And one is taken off the list entirely', async () => {
      await page
        .getByRole('button', { name: `Remove ${FILMS[3]} from your list` })
        .click();
      await expect.poll(async () => (await listRows()).length).toBe(3);
      await expect(rows).toHaveCount(3);
    });

    await beat(page, 'The watchlist is empty until something is marked', async () => {
      await page.goto('/watchlist');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Watchlist' }),
      ).toBeVisible();
      await expect(page.getByText('You have not marked anything yet')).toBeVisible();
    });

    await beat(page, 'A film is marked watched, and lands here', async () => {
      await markWatched(memberId, FILMS[0] as string);
      await page.reload();
      // The title links on to the film's own page — `getByText` would also
      // catch the toggle's screen-reader label, which names the film too.
      await expect(page.getByRole('link', { name: FILMS[0] as string })).toBeVisible();
      await expect(
        page.getByRole('button', { name: new RegExp(`${FILMS[0]} — watched`) }),
      ).toBeVisible();
    });

    await beat(page, 'And the season can be read three other ways', async () => {
      const tabs = page.getByRole('navigation', { name: 'Watchlist views' });
      for (const [view, label] of [
        ['awards', 'By show'],
        ['nominations', 'Most nominated'],
        ['drafted', 'Drafted'],
      ] as const) {
        await page.goto(`/watchlist?view=${view}`);
        await expect(tabs.getByRole('link', { name: label })).toHaveAttribute(
          'aria-current',
          'page',
        );
        // 🔴 Not merely "the tab is lit": the watched list is genuinely gone.
        // Without this the beat would pass against a page that rendered the
        // same view four times with a different chip on it — and the scratch
        // film is nominated nowhere and drafted nowhere, so it belongs on none
        // of these three.
        await expect(page.getByText(FILMS[0] as string)).toHaveCount(0);
      }
    });

    await beat(page, 'The badge can be undone, and it sticks', async () => {
      await page.goto('/watchlist');
      // 🔴 The testid, not the name (D66). The accessible name *changes* when
      // the film is unmarked, by design, so a name-based handle resolves to a
      // different element after the click — the name is the assertion above,
      // this is the handle.
      await page.getByTestId(`watched-toggle-${TMDB_IDS[0]}`).click();
      await expect.poll(watchedCount).toBe(0);
      await page.reload();
      await expect(page.getByText('You have not marked anything yet')).toBeVisible();
    });
  });
});
