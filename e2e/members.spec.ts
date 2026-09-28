import { expect, test } from '@playwright/test';

import { activeYear, cleanupLeague } from './journeys/support/scratch';
import { signInAs } from './support/session';

const TAG = 'e2e-t37';

/**
 * `/members/[uuid]` is public, and a signed-out reader gets initials (P17.T37).
 *
 * 🔴 **What this file cannot check.** Under `E2E_TEST_AUTH=1` `proxy.ts` exports
 * a pass-through with no route protection at all, so nothing here observes the
 * redirect that adding `/members/(.*)` to `isPublic` removes — `proxy.test.ts`
 * pins that list verbatim and is the only guard on it. What this file *does*
 * check is the half a unit test cannot: what actually reaches the wire.
 *
 * 🔴 The scratch member is seeded with a **Gravatar-shaped** avatar on purpose.
 * A member with a null image renders initials whatever the page does, so a test
 * against one could not go red — and 51 of the 60 real members carry exactly
 * this shape, a path that is `MD5(email)`.
 */

const GRAVATAR =
  'https://s.gravatar.com/avatar/3a5b81ef1d8d7a29e40e3cd1d4d10e2f?s=480&r=pg&d=mp';

/** The same `pg` route the other specs take — Playwright cannot resolve `@/`. */
async function withDb<T>(run: (query: Client['query']) => Promise<T>): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await run(client.query.bind(client) as Client['query']);
  } finally {
    await client.end();
  }
}
type Client = import('pg').Client;

async function cleanup() {
  // Feed rows first and by message: `profile_feeds` has no foreign key to
  // `users`, and the roster post's message carries the league name, so the tag.
  await withDb((query) =>
    query('delete from profile_feeds where message like $1', [`%${TAG}%`]),
  );
  await cleanupLeague(TAG);
  await withDb((query) =>
    query('delete from users where email like $1', [`${TAG}-%@example.test`]),
  );
}

/** Eight invented films, past the five the roster post used to stop at. */
const ROSTER = [
  'Zephyrine',
  'Quillon',
  'Bastable',
  'Narrowdale',
  'Pellucid',
  'Thrimble',
  'Vantry',
  'Okenshaw',
].map((word) => `${TAG} ${word}`);

/**
 * A league on the clock with one seat, the owner's, holding all eight picks in
 * pick order. Finishing it through the setup page is what writes the roster
 * post, so the post under test is the one `completeDraft` writes.
 */
async function seedActiveLeague(ownerId: number, year: number): Promise<number> {
  return withDb(async (query) => {
    const { rows: leagues } = await query<{ id: number }>(
      `insert into leagues (name, owner, uuid, drafting_status, created_at, updated_at)
         values ($1, $2, gen_random_uuid(), 'active', now(), now()) returning id`,
      [`${TAG} Racso`, JSON.stringify([ownerId])],
    );
    const leagueId = leagues[0]?.id as number;
    const { rows: seats } = await query<{ id: number }>(
      `insert into drafts (user_id, league_id, year, "group", "order", dummy,
                           created_at, updated_at)
         values ($1, $2, $3, 1, 1, false, now(), now()) returning id`,
      [ownerId, leagueId, year],
    );
    for (const [order, title] of ROSTER.entries()) {
      const { rows: movies } = await query<{ id: number }>(
        `insert into movies (title, sort_title, tmdb_id, created_at, updated_at)
           values ($1, $1, $2, now(), now()) returning id`,
        [title, `99937${String(order).padStart(4, '0')}`],
      );
      await query(
        `insert into draft_picks (draft_id, movie_id, user_id, "order", created_at, updated_at)
           values ($1, $2, $3, $4, now(), now())`,
        [seats[0]?.id, movies[0]?.id, ownerId, order + 1],
      );
    }
    return leagueId;
  });
}

/** A throwaway member who carries a Gravatar URL, and their profile uuid. */
async function seedMember(name: string): Promise<string> {
  const email = `${TAG}-${name}@example.test`;
  return withDb(async (query) => {
    const { rows } = await query<{ uuid: string }>(
      `insert into users (uuid, email, first_name, last_name, image, role, provider,
                          created_at, updated_at)
         values (gen_random_uuid(), $1, $2, 'Member', $3, 'user', 'e2e', now(), now())
       on conflict (email) do update set image = excluded.image, updated_at = now()
       returning uuid`,
      [email, name, GRAVATAR],
    );
    const uuid = rows[0]?.uuid;
    if (!uuid) throw new Error(`could not seed ${email}`);
    return uuid;
  });
}

test.describe('a member page', () => {
  // Serial: every test here matches one tag and the teardown clears the tag
  // wholesale, so run side by side one test's cleanup takes another's member.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(cleanup);
  test.afterAll(cleanup);

  test('opens for a stranger without publishing a hash of the email', async ({
    page,
  }) => {
    const uuid = await seedMember('subject');

    // This test signs nobody in. A fresh context, so no cookie from elsewhere.
    const response = await page.goto(`/members/${uuid}`);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(`/members/${uuid}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('subject');

    // 🔴 The bar: nothing that identifies the address reaches the wire. Read
    // from the served document rather than the DOM, because the leak would be
    // an `<img src>` and the RSC payload carries it too.
    const html = (await response?.text()) ?? '';
    expect(html).not.toContain('gravatar');
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);

    // And the fallback is actually rendered, so "no gravatar" is not "no
    // avatar at all".
    await expect(page.getByTestId('member-initials')).toHaveText('S');
  });

  test('a signed-in member still sees the face', async ({ page }) => {
    const uuid = await seedMember('subject');
    await signInAs(page, {
      email: `${TAG}-reader@example.test`,
      firstName: 'Reader',
    });

    await page.goto(`/members/${uuid}`);

    // The image is expected here and is fine: the reader already has an account.
    await expect(page.getByTestId('member-avatar')).toHaveAttribute('src', /gravatar/);
    await expect(page.getByTestId('member-initials')).toHaveCount(0);
  });

  test('a stranger is offered nothing that writes', async ({ page }) => {
    const uuid = await seedMember('subject');

    await page.goto(`/members/${uuid}`);

    // `isSelf` must be false for an anonymous reader, or the composer posts
    // into a feed resolved from a session that does not exist.
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /post|delete/i })).toHaveCount(0);
  });

  test('a finished draft posts the whole roster, not five and a count', async ({
    page,
  }) => {
    const ownerId = await signInAs(page, {
      email: `${TAG}-owner@example.test`,
      firstName: 'Owner',
    });
    const year = await activeYear();
    const leagueId = await seedActiveLeague(ownerId, year);

    await page.goto(`/leagues/${leagueId}/setup?year=${year}`);
    await page.getByRole('button', { name: 'Finish the draft' }).click();
    // Scoped to the dialog: the trigger underneath shares its accessible name.
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Finish the draft' })
      .click();
    await expect(page.getByText('The draft is finished')).toBeVisible();

    const uuid = await withDb(async (query) => {
      const { rows } = await query<{ uuid: string }>(
        'select uuid::text as uuid from users where id = $1',
        [ownerId],
      );
      return rows[0]?.uuid as string;
    });
    await page.goto(`/members/${uuid}`);

    const post = page
      .getByRole('article')
      .filter({ hasText: `drafted these movies in the ${year} ${TAG} Racso league.` });
    const roster = post.getByRole('list', { name: 'Drafted films, in draft order' });

    // 🔴 Every pick, in pick order, each a poster linked to its film — the
    // post used to stop at five and say "and 3 more films".
    await expect(roster.getByRole('listitem')).toHaveCount(ROSTER.length);
    await expect(roster.getByRole('figure')).toHaveCount(ROSTER.length);
    // Contains, not equals: a frame with no poster prints initials above the title.
    await expect(roster.getByRole('figure')).toContainText(ROSTER);
    await expect(roster.getByRole('link')).toHaveCount(ROSTER.length);
    for (const link of await roster.getByRole('link').all()) {
      await expect(link).toHaveAttribute('href', /^\/films\/e2e-[a-z0-9-]+-99937\d{4}$/);
    }
    await expect(post.getByText(/more films?$/)).toHaveCount(0);
  });
});
