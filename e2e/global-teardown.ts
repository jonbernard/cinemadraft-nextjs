/**
 * Remove every throwaway account the suite created — in **both** places it
 * exists — after all of it has run.
 *
 * 🔴 Two separate leaks, and the second one stopped the suite dead.
 *
 * **The database.** The specs sign up real Clerk identities, and
 * `lib/auth.ts` provisions an account lazily for any valid session that
 * reaches a page — so a request already in flight when a spec's own teardown
 * runs can re-create the row it just deleted. One survivor fails
 * `lib/db.test.ts`, which asserts the restored database still holds exactly
 * the 60 real people it was migrated with. A global teardown runs after every
 * browser is closed and every request has landed, which is the only point at
 * which "nothing can recreate this" is actually true.
 *
 * **Clerk.** Deleting the local row does nothing to the identity that created
 * it. Those accumulated silently across every run until the development
 * instance hit its **100-user ceiling**, at which point sign-up stopped
 * working and four specs failed at once with what looked like a timeout — the
 * real message ("You have reached your limit of 100 users") was rendered
 * inside the Clerk widget, not raised as an error. Nothing in the app was
 * broken; the suite had exhausted a quota by leaking.
 *
 * Deleting is scoped to addresses containing `+clerk_test`, which only this
 * suite creates. A real account cannot match, and the deletion is skipped
 * entirely without a secret key rather than failing the run.
 */

type ClerkUser = {
  id: string;
  email_addresses?: { email_address: string }[];
};

/** Only ever true for an address this suite generated. */
function isTestIdentity(user: ClerkUser): boolean {
  return (user.email_addresses ?? []).some((email) =>
    email.email_address.includes('+clerk_test'),
  );
}

async function clearClerkTestIdentities(secret: string): Promise<void> {
  const headers = { Authorization: `Bearer ${secret}` };

  // Paged rather than one pass: the list endpoint caps at 100 per request,
  // which is the same number as the ceiling that caused the failure.
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch('https://api.clerk.com/v1/users?limit=100', { headers });
    if (!response.ok) return;

    const users = (await response.json()) as ClerkUser[];
    const disposable = users.filter(isTestIdentity);
    if (disposable.length === 0) return;

    for (const user of disposable) {
      await fetch(`https://api.clerk.com/v1/users/${user.id}`, {
        method: 'DELETE',
        headers,
      });
    }
  }
}

export default async function globalTeardown(): Promise<void> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("delete from users where email like '%+clerk_test@%'");
  } finally {
    await client.end();
  }

  const secret = process.env.CLERK_SECRET_KEY;
  if (secret) await clearClerkTestIdentities(secret);
}
