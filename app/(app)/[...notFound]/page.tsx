import { notFound } from 'next/navigation';

import { requirePageUser } from '@/lib/auth';

/**
 * Every URL that matches nothing else, pulled inside the app shell.
 *
 * 🔴 Next answers a completely unmatched URL with the **root**
 * `app/not-found.tsx`, which sits outside the `(app)` group and therefore
 * renders with no rail, no tab bar and no strip — a member who mistyped a
 * league id was dropped out of the application with one link back. A group's
 * own `not-found.tsx` only fires for a `notFound()` thrown by a page *inside*
 * it, so `/live` and `/members`, which are directories with a dynamic child
 * and no index, never reached it.
 *
 * This page exists so that they do. It renders nothing of its own: calling
 * `notFound()` from inside the group is what makes `(app)/not-found.tsx` the
 * responder, and the shell comes with it.
 *
 * 🔴 Non-optional (`[...notFound]`, not `[[...notFound]]`). The optional form
 * also matches `/`, which would shadow the dashboard. Static and dynamic
 * segments both outrank a catch-all in Next's route ranking, so every real
 * route — `/leagues/1`, `/auth/login`, `/api/*` — is unaffected;
 * `e2e/errors.spec.ts` and `e2e/nav.spec.ts` are what prove it.
 *
 * 🔴 The gate is parity, not intent. The proxy protected every path its list
 * did not name, so an unmatched URL has always sent a logged-out visitor to
 * log in rather than saying "not here" — `e2e/errors.spec.ts` records that as
 * deliberate, and the cost as accepted. Moving protection onto the resource
 * would have dropped it silently, which is a change to the boundary made by
 * forgetting, so it is written down instead. It is the one line here an owner
 * might well want deleted: a typo'd URL is not a protected resource, and
 * nothing behind this page reads anything.
 */
export default async function CatchAll() {
  await requirePageUser();
  notFound();
}
