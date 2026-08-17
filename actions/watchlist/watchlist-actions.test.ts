// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

// `revalidatePath` needs a request store, which no test has. Mocking it keeps
// these tests about authorization and data; that the paths are revalidated is
// asserted directly, below.
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { setWatched } from './set-watched';

/**
 * 🔴 The refusals first, and each one asserts the **database is unchanged**
 * rather than that the call came back unhappy. A guard that throws after writing
 * is not a guard.
 *
 * This is the app's first write reachable from an ordinary browsing page rather
 * than from an owner's console, so an anonymous caller hitting it is normal
 * traffic: `/browse` and every film page are public (D44), and the badge simply
 * is not rendered when logged out. Refusing quietly is the correct behaviour,
 * not an anomaly worth an error page.
 *
 * Everything is seeded, so this suite runs on CI where there is a schema and no
 * data.
 */
const TAG = 'watchlist-actions';
const DOMAIN = '@example.test';

type Fixture = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const now = new Date();

  const [viewer, other] = await Promise.all(
    ['viewer', 'other'].map((role) =>
      db.user.create({
        data: {
          uuid: randomUUID(),
          email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
          clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, email: true, clerkId: true },
      }),
    ),
  );

  // A cached film, so the ordinary path needs no TMDB call at all. The title
  // carries the tag: the restored database has real films, and cleanup that
  // deleted by a plain title would take one.
  const film = await db.movie.create({
    data: {
      title: `${TAG} Sinners`,
      sortTitle: `${TAG} Sinners`,
      tmdbId: `9${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, tmdbId: true, title: true },
  });

  return { viewer, other, film };
}

/** Points Clerk at a seeded row, or at nobody. */
function signInAs(user: { clerkId: string | null; email: string } | null) {
  if (!user) {
    currentUser.mockResolvedValue(null);
    return;
  }
  currentUser.mockResolvedValue({
    id: user.clerkId,
    emailAddresses: [{ emailAddress: user.email, verification: { status: 'verified' } }],
    firstName: null,
    lastName: null,
    imageUrl: null,
  });
}

async function countFor(userId: number, movieId: number) {
  return db.watchlist.count({
    where: { userId: BigInt(userId), movieId: BigInt(movieId) },
  });
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { contains: `${TAG}-` } },
    select: { id: true },
  });
  const films = await db.movie.findMany({
    where: { title: { startsWith: `${TAG} ` } },
    select: { id: true },
  });
  await db.watchlist.deleteMany({
    where: {
      OR: [
        { userId: { in: users.map((user) => BigInt(user.id)) } },
        { movieId: { in: films.map((film) => BigInt(film.id)) } },
      ],
    },
  });
  await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await db.movie.deleteMany({ where: { id: { in: films.map((film) => film.id) } } });
}

let fixture: Fixture;

beforeEach(async () => {
  currentUser.mockReset();
  revalidatePath.mockClear();
  await cleanup();
  fixture = await seed();
});

afterEach(cleanup);

afterAll(async () => {
  await db.$disconnect();
});

describe('refusals', () => {
  it('🔴 refuses an anonymous caller and writes nothing', async () => {
    signInAs(null);
    const before = await db.watchlist.count();

    const result = await setWatched({
      tmdbId: fixture.film.tmdbId as string,
      watched: true,
    });

    expect(result.ok).toBe(false);
    expect(await db.watchlist.count()).toBe(before);
  });

  it('refuses an unparseable film id and writes nothing', async () => {
    signInAs(fixture.viewer);
    const before = await db.watchlist.count();

    const result = await setWatched({ tmdbId: '', watched: true });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await db.watchlist.count()).toBe(before);
  });

  it('refuses a film TMDB does not know, rather than storing a dangling id', async () => {
    // `watchlists.movie_id` has no foreign key, so a bad id would be stored
    // happily and the film would show as a blank row on the watchlist forever.
    signInAs(fixture.viewer);
    const before = await db.watchlist.count();

    const result = await setWatched({ tmdbId: '999999999999', watched: true });

    expect(result.ok).toBe(false);
    expect(await db.watchlist.count()).toBe(before);
  });
});

describe('marking a film watched', () => {
  beforeEach(() => {
    signInAs(fixture.viewer);
  });

  it('stores one row for a cached film', async () => {
    const result = await setWatched({
      tmdbId: fixture.film.tmdbId as string,
      watched: true,
    });

    expect(result).toEqual({ ok: true, data: { watched: true } });
    expect(await countFor(fixture.viewer.id, fixture.film.id)).toBe(1);
  });

  it('🔴 is idempotent — marking twice leaves one row', async () => {
    // A member double-taps the badge on a browse grid, or has two tabs open.
    // Neither is an error, and neither may produce a film that appears twice on
    // their watchlist.
    const tmdbId = fixture.film.tmdbId as string;

    await setWatched({ tmdbId, watched: true });
    const second = await setWatched({ tmdbId, watched: true });

    expect(second.ok).toBe(true);
    expect(await countFor(fixture.viewer.id, fixture.film.id)).toBe(1);
  });

  it('revalidates the pages that show the badge', async () => {
    await setWatched({ tmdbId: fixture.film.tmdbId as string, watched: true });

    const paths = revalidatePath.mock.calls.map((call) => call.at(0));
    expect(paths).toContain('/browse');
    expect(paths).toContain('/watchlist');
  });
});

describe('unmarking a film', () => {
  beforeEach(() => {
    signInAs(fixture.viewer);
  });

  it('removes the row', async () => {
    const tmdbId = fixture.film.tmdbId as string;
    await setWatched({ tmdbId, watched: true });

    const result = await setWatched({ tmdbId, watched: false });

    expect(result).toEqual({ ok: true, data: { watched: false } });
    expect(await countFor(fixture.viewer.id, fixture.film.id)).toBe(0);
  });

  it('succeeds when the film was never marked', async () => {
    // The badge and the database can disagree for a moment with two tabs open.
    // Reporting a failure there would be a toast about nothing.
    const result = await setWatched({
      tmdbId: fixture.film.tmdbId as string,
      watched: false,
    });

    expect(result.ok).toBe(true);
  });

  it('🔴 deletes only the caller’s row', async () => {
    // The source deleted by a row id taken off the URL
    // (`DELETE /watchlist/item/:id`), so the id being someone else's was not a
    // question the route could ask. Keyed on (userId, movieId), another
    // person's row is not addressable at all.
    const tmdbId = fixture.film.tmdbId as string;
    await setWatched({ tmdbId, watched: true });
    signInAs(fixture.other);
    await setWatched({ tmdbId, watched: true });

    await setWatched({ tmdbId, watched: false });

    expect(await countFor(fixture.other.id, fixture.film.id)).toBe(0);
    expect(await countFor(fixture.viewer.id, fixture.film.id)).toBe(1);
  });
});

describe('a film the app has never cached', () => {
  it('🔴 ingests it, because this is a person deliberately acting', async () => {
    // The opposite decision from the film *page*, which never writes (D63). The
    // distinction is who caused it: a page render is anonymous traffic and may
    // be a crawler, while this is a logged-in member pressing a button, and the
    // row has to exist before anything can point at it.
    signInAs(fixture.viewer);
    // 🔴 An id no real film has. The first version of this test used Superman's
    // real id, 1061474 — which is already one of the 1,355 cached rows, so
    // nothing was ingested, the assertion compared against the real title, and
    // the run left a watchlist row attached to a genuine film that cleanup
    // could not see.
    const tmdbId = '999000111';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: Number(tmdbId),
          title: `${TAG} Uncached Film`,
          imdb_id: 'tt9990001',
          poster_path: '/x.jpg',
          release_date: '2026-07-11',
        }),
      })) as unknown as typeof fetch,
    );
    process.env.TMDB_API_KEY = 'test-tmdb-key';

    try {
      const result = await setWatched({ tmdbId, watched: true });

      expect(result.ok).toBe(true);
      const cached = await db.movie.findFirst({
        where: { tmdbId },
        select: { id: true, title: true },
      });
      expect(cached?.title).toBe(`${TAG} Uncached Film`);
      expect(await countFor(fixture.viewer.id, cached?.id as number)).toBe(1);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.TMDB_API_KEY;
      // No extra cleanup needed: the ingested film's title carries the tag, so
      // `cleanup()` reaches both it and the row pointing at it. Deleting
      // watchlist rows by anything broader than a tagged id would take real
      // ones — there are 486 in the restored data.
    }
  });
});
