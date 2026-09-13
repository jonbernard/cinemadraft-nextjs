import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

import { signTestSession, TEST_SESSION_COOKIE } from '../../lib/test-auth';

/**
 * Seed a user and put a signed test session in the browser's cookie jar.
 *
 * No Clerk, no email round trip, no test-user churn (D82/D84). The user row is
 * created directly, because the app's own creation path is Clerk's webhook and
 * this run has no Clerk.
 *
 * Uses `pg` rather than the Prisma client, the way every other spec that talks
 * to the database does: Playwright does not resolve the `@/` path alias into
 * `generated/prisma`, so importing `lib/db` here fails at require time and
 * takes the whole spec with it. `lib/test-auth` is imported by relative path
 * for the same reason, and is safe to import from a plain Node process because
 * it pulls in `next/headers` only inside the function that needs it.
 *
 * 🔴 The signature is only accepted by a server that agrees on
 * `E2E_TEST_AUTH_SECRET`. `playwright.config.mts` sets one value into this
 * process and hands the same one to the webServer, so a run that forgot the
 * secret fails as "not signed in" rather than signing everybody in.
 *
 * Returns the user's id, which specs need for their own row assertions.
 */
export async function signInAs(
  page: Page,
  user: { email: string; firstName?: string; lastName?: string },
): Promise<number> {
  const id = await upsertUser(user);

  await page.context().addCookies([
    {
      name: TEST_SESSION_COOKIE,
      value: signTestSession(id),
      // 🔴 `url` and `path` together are rejected — "Cookie should have either
      // url or path" — and the rejection is thrown by `addCookies`, so it fails
      // every spec that signs anybody in rather than one. The url already
      // implies domain `localhost` and path `/`, which is what this needs.
      // The port follows `E2E_PORT`, as the server's does (playwright.config.mts).
      url: `http://localhost:${process.env.E2E_PORT ?? '3000'}`,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  return id;
}

/**
 * The row, created or reused.
 *
 * Reused rather than replaced on a second call: a spec that signs the same
 * person in twice is describing one member, and a fresh row each time would
 * orphan whatever the first one had already joined.
 */
async function upsertUser(user: {
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<number> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: number }>(
      `insert into users (uuid, email, first_name, last_name, role, provider, created_at, updated_at)
       values ($1, $2, $3, $4, 'user', 'e2e', now(), now())
       on conflict (email) do update set updated_at = now()
       returning id`,
      [randomUUID(), user.email, user.firstName ?? null, user.lastName ?? null],
    );

    const id = rows[0]?.id;
    if (id == null) throw new Error(`could not seed a user for ${user.email}`);
    return id;
  } finally {
    await client.end();
  }
}
