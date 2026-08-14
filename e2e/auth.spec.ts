import { clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

/**
 * 🔴 The Phase 4 gate, in a browser.
 *
 * `clerk-identity.production.test.ts` proves the claim rules against a real
 * restored account at the data layer. This proves the other half: that a
 * person can actually get through the flow — the pages render, the passwordless
 * code path works, and a protected route lets them in afterwards.
 *
 * Clerk development instances accept any address containing `+clerk_test` and
 * always take the verification code 424242, so this needs no inbox and sends
 * no mail. `setupClerkTestingToken` bypasses bot protection, which would
 * otherwise fail the run on a fresh browser.
 *
 * Skipped when Clerk keys are absent, so a checkout without secrets can still
 * run the suite.
 */
const hasClerk = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

test.describe('auth', () => {
  test.skip(!hasClerk, 'Clerk keys not configured');

  test.beforeAll(async () => {
    await clerkSetup();
  });

  /**
   * Remove the accounts this spec created.
   *
   * The local database holds the restored production data, and every run of
   * the sign-up test provisions a real row in it. Left alone they accumulate
   * against the 60 genuine users, and any later assertion about that
   * population quietly starts measuring test debris instead.
   *
   * The Clerk identities themselves are disposable dev-instance records and
   * are left alone.
   *
   * Uses `pg` rather than the Prisma client: Playwright does not resolve the
   * `@/` path alias into `generated/prisma`, so importing `lib/db` here fails
   * at require time and takes the whole spec with it.
   */
  test.afterAll(async () => {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("delete from users where email like '%+clerk_test@%'");
    } finally {
      await client.end();
    }
  });

  test('the sign-up page leads with the returning-member promise', async ({ page }) => {
    await page.goto('/auth/sign-up');

    // The single most important sentence in the migration: every existing
    // member is signing UP, and needs to know their history follows them.
    await expect(page.getByText('Played before?')).toBeVisible();
    await expect(
      page.getByText(/leagues, drafts and points come with you/i),
    ).toBeVisible();
  });

  test('offers no password field — the flow is passwordless (D26)', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('a protected route sends a signed-out visitor to sign-in', async ({ page }) => {
    await page.goto('/leagues');
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test('a new member can sign up and reach a protected route', async ({ page }) => {
    await setupClerkTestingToken({ page });

    // Unique per run: Clerk keeps identities between runs, and reusing one
    // would test the sign-IN path while claiming to test sign-up.
    //
    // The uniqueness goes BEFORE the `+`, because the subaddress must be
    // exactly `clerk_test` for Clerk to treat this as a test address. Writing
    // `e2e+clerk_test_1786…` makes the subaddress `clerk_test_1786…`, which
    // Clerk does not recognise — it then tries to deliver a real email, no
    // code is ever sent, and the form reports "You need to send a verification
    // code before attempting to verify".
    const address = `e2e_${Date.now()}+clerk_test@example.com`;

    await page.goto('/auth/sign-up');
    await page.getByLabel(/email address/i).fill(address);

    // Wait for the code to actually be SENT before typing one.
    //
    // The OTP field submits the moment it is full, so filling it as soon as it
    // appears races Clerk's prepare_verification call and the form answers
    // "You need to send a verification code before attempting to verify".
    // Waiting on a UI cue (the resend countdown) looked right and still failed
    // roughly one run in three — the control renders before the request
    // resolves. The network response is the real signal, so wait on that.
    const codeSent = page.waitForResponse(
      (response) => response.url().includes('prepare_verification') && response.ok(),
      { timeout: 20_000 },
    );

    // Exact match: "Sign in with Google Continue" also matches a loose
    // /continue/i, and clicking that would leave the run testing OAuth.
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await codeSent;

    // 424242 is Clerk's fixed code for +clerk_test addresses.
    await page.getByRole('textbox', { name: /verification code/i }).fill('424242');

    // Wait for Clerk to finish rather than navigating straight off. Filling
    // the code auto-submits, and the session is not established until that
    // round trip lands — leaving immediately raced it and produced a
    // signed-out browser, which reads as "sign-up is broken".
    await expect(page).not.toHaveURL(/\/auth\/sign-up/, { timeout: 20_000 });

    await page.goto('/leagues');
    await expect(page).not.toHaveURL(/\/auth\/sign-in/);

    // Reaching the page is not enough: an account has to exist behind the
    // session. Locally the Clerk webhook posts to the deployed host and never
    // arrives here, so this asserts the lazy claim path actually provisioned
    // the row — without it the test passed while creating no account at all.
    await expect(page.getByText(address, { exact: false })).toBeVisible({
      timeout: 15_000,
    });
  });
});
