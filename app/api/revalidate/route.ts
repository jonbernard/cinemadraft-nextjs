import { timingSafeEqual } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { revalidateEnv } from '@/lib/env';

/**
 * Clear the render cache for an award show, from outside the app.
 *
 * 🔴 **Why this route exists at all** (D8 says HTTP endpoints do not).
 * `scripts/award-import.mjs` writes nominations straight to Neon, which is the
 * only way to enter a whole show at once — the server actions are Clerk-gated
 * and not callable from a script. Those actions all end in
 * `revalidatePath('/award-shows/<abbr>', 'layout')`, and `revalidatePath` has
 * no out-of-process equivalent. So the script asks the running app to make the
 * call it cannot make itself. A webhook is HTTP by definition; so is this.
 *
 * 🔴 **The caller names a show, never a path.** Accepting a path would be an
 * unauthenticated-shaped invalidation endpoint for every route in the app. The
 * abbreviation is checked against a slug pattern and interpolated into a fixed
 * list.
 *
 * 🔴 **404 on a bad secret, not 401.** A 401 tells a prober the route is real
 * and that the secret is the only thing between them and it.
 *
 * It writes nothing and reads nothing. The worst an attacker holding the
 * secret can do is make four pages re-render.
 */
const SLUG = /^[a-z0-9-]{1,50}$/i;

function secretMatches(given: unknown): boolean {
  const expected = revalidateEnv.secret;
  if (!expected || typeof given !== 'string') return false;

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length through the error path.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  let body: { secret?: unknown; abbreviation?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response('not found', { status: 404 });
  }

  if (!secretMatches(body.secret)) return new Response('not found', { status: 404 });

  const abbreviation = body.abbreviation;
  if (typeof abbreviation !== 'string' || !SLUG.test(abbreviation)) {
    return new Response('bad abbreviation', { status: 400 });
  }

  const paths = [`/award-shows/${abbreviation}`, '/award-shows', '/leaderboard', '/'];
  revalidatePath(paths[0] as string, 'layout');
  revalidatePath('/award-shows');
  revalidatePath('/leaderboard');
  revalidatePath('/');

  return Response.json({ revalidated: paths });
}
