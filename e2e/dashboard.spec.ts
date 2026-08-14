import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * 🔴 The Phase 5 gate from `docs/PLAN.md`:
 *
 *   "E2E green; no truncated titles at any breakpoint."
 *
 * Truncation is the specific defect this redesign exists to fix. The current
 * app overlays titles on the artwork, so a member scanning their roster sees
 * "One Ba…", "Is This …", "Wake …" — the film becomes unidentifiable at
 * exactly the moment they are looking for it. §6.7 moves the title below the
 * frame at full width for this reason.
 *
 * The title under test is read from the database — whichever film on this
 * member's roster has the longest name — so the assertion always points at the
 * hardest real case rather than a string that was true once.
 */

/** A real restored account with a 2026 roster in league 1. Referenced by id. */
const MEMBER_ID = 6;

const hasClerk = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

/**
 * Raw `pg` rather than the Prisma client: Playwright does not resolve the
 * `@/` alias into `generated/prisma`, so importing `lib/db` fails at require
 * time and takes the whole spec with it.
 */
async function withDb<T>(
  fn: (query: (sql: string, params?: unknown[]) => Promise<unknown[]>) => Promise<T>,
): Promise<T> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(async (sql, params) => (await client.query(sql, params)).rows);
  } finally {
    await client.end();
  }
}

/**
 * Sign up a throwaway Clerk identity, then attach it to a real restored
 * account.
 *
 * This is the only honest way to see the signed-in dashboard: a fresh sign-up
 * has no leagues, so it would only ever exercise the empty state. Moving the
 * identity onto a real row is what the admin relink path does in production
 * (P4.T8), and it is undone in `afterAll`.
 *
 * The uniqueness goes BEFORE the `+`, because the subaddress must be exactly
 * `clerk_test` for Clerk to treat this as a test address.
 */
/**
 * The longest title on this member's roster, read from the database.
 *
 * Hardcoding it was wrong once already: the longest title in the 2026 data
 * overall belongs to a different member's seat, so the assertion looked for a
 * film that was never on this page. Deriving it keeps the test pointed at the
 * hardest real case even as the draft changes.
 */
async function longestRosterTitle(): Promise<string> {
  return withDb(async (query) => {
    const rows = (await query(
      `select m.title from movies m
         join draft_picks dp on dp.movie_id = m.id
         join drafts d on d.id = dp.draft_id and d.year = 2026 and d.user_id = $1
        order by length(m.title) desc
        limit 1`,
      [MEMBER_ID],
    )) as { title: string }[];
    const title = rows[0]?.title;
    if (!title) throw new Error(`user ${MEMBER_ID} has no 2026 roster`);
    return title;
  });
}

async function signInAsMember(page: Page): Promise<void> {
  await setupClerkTestingToken({ page });
  const address = `e2e_dash_${Date.now()}+clerk_test@example.com`;

  await page.goto('/auth/sign-up');
  await page.getByLabel(/email address/i).fill(address);

  // Wait for the code to be SENT before entering one — the OTP field submits
  // as soon as it is full, and filling it early races prepare_verification.
  const codeSent = page.waitForResponse(
    (response) => response.url().includes('prepare_verification') && response.ok(),
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await codeSent;

  await page.getByRole('textbox', { name: /verification code/i }).fill('424242');
  await expect(page).not.toHaveURL(/\/auth\/sign-up/, { timeout: 20_000 });

  await withDb(async (query) => {
    const rows = (await query('select clerk_id from users where email = $1', [
      address,
    ])) as {
      clerk_id: string | null;
    }[];
    const clerkId = rows[0]?.clerk_id;
    if (!clerkId) throw new Error('sign-up did not provision an account');

    // Free the id from the throwaway row before moving it: clerk_id is unique.
    await query('update users set clerk_id = null where email = $1', [address]);
    await query('update users set clerk_id = $1 where id = $2', [clerkId, MEMBER_ID]);
  });
}

test.describe('dashboard', () => {
  test.beforeAll(async () => {
    // Resolves the Clerk Frontend API URL that setupClerkTestingToken needs to
    // bypass bot protection. It is per-file, not global.
    if (hasClerk) await clerkSetup();
  });

  test.afterAll(async () => {
    // Put the restored account back exactly as the migration left it. Leaving
    // a test identity attached to real production data would make the next
    // run assert against a state the restore never produced.
    await withDb(async (query) => {
      await query('update users set clerk_id = null where id = $1', [MEMBER_ID]);
      await query("delete from users where email like '%+clerk_test@%'");
    });
  });

  test('🔴 signed out, it shows the season and no one else’s team (D44)', async ({
    page,
  }) => {
    await page.goto('/');

    // The public variant is the season itself. A login wall on the front page
    // during awards season is the worst possible first impression.
    await expect(
      page.getByRole('heading', { name: 'Season', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();

    // And nothing that belongs to a person.
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('list', { name: /drafted films/i })).toHaveCount(0);
  });

  test.describe('signed in', () => {
    test.skip(!hasClerk, 'Clerk keys not configured');

    test('shows the member’s roster, total and standings', async ({ page }) => {
      await signInAsMember(page);
      await page.goto('/');

      await expect(page.getByRole('list', { name: /drafted films/i })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
      // The viewer is findable without relying on colour.
      await expect(page.getByText('You', { exact: true })).toBeVisible();
    });

    // 375 is an iPhone SE, 768 an iPad portrait, 1440 a laptop — the three
    // widths the roster grid changes shape at (2 / 4 / 8 across).
    for (const width of [375, 768, 1440]) {
      test(`🔴 no truncated titles at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await signInAsMember(page);
        await page.goto('/');

        const longest = await longestRosterTitle();
        const title = page.getByText(longest, { exact: true });
        await expect(title).toBeVisible();

        // The old app's defect was the *text* being cut to "Wake …", so the
        // film could not be identified or selected. Assert the whole string is
        // really in the DOM, not an ellipsis standing in for it.
        await expect(title).toHaveText(longest);

        // And that it is not visually clipped. §6.7 specifies a two-line
        // clamp, so this checks the title fits the space it was given rather
        // than overflowing it invisibly.
        const clipped = await title.evaluate(
          (el) => el.scrollHeight > el.clientHeight + 1,
        );
        expect(clipped, `"${longest}" is clipped at ${width}px`).toBe(false);
      });
    }
  });
});
