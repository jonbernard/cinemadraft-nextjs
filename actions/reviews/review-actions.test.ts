// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { deleteReview } from './delete-review';
import { saveReview } from './save-review';

/**
 * Saving, editing and removing a review, against the real schema.
 *
 * 🔴 `reviews` has no rows in production and no captured fixture, so this file
 * and `lib/services/reviews.test.ts` are the only evidence the feature has. Both
 * seed everything they touch and run on CI, where there is a schema and no data.
 *
 * The two members and the two films below carry **different** values on purpose.
 * A query scoped on `(userId, movieId)` that lost either clause would still
 * leave a row of the right shape behind, so every scoping assertion here names a
 * value only the correct code produces.
 */
const TAG = 'review-actions';
const DOMAIN = '@example.test';

type Fixture = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const now = new Date();

  const [author, stranger] = await Promise.all(
    ['author', 'stranger'].map((role) =>
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

  // Cached, so the ordinary path needs no TMDB call. The title carries the tag
  // because the restored database holds real films and cleanup must not take one.
  const [film, otherFilm] = await Promise.all(
    ['The Brutalist', 'Anora'].map((title) =>
      db.movie.create({
        data: {
          title: `${TAG} ${title}`,
          sortTitle: `${TAG} ${title}`,
          tmdbId: `9${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, tmdbId: true },
      }),
    ),
  );

  return { author, stranger, film, otherFilm };
}

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

async function rowsFor(movieId: number) {
  const rows = await db.review.findMany({
    where: { movieId },
    select: { id: true, userId: true, rating: true, review: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    rating: row.rating === null ? null : row.rating.toNumber(),
    review: row.review,
  }));
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
  await db.review.deleteMany({
    where: {
      OR: [
        { userId: { in: users.map((user) => user.id) } },
        { movieId: { in: films.map((film) => film.id) } },
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

    const result = await saveReview({
      tmdbId: fixture.film.tmdbId as string,
      rating: 4,
      review: 'I should not be able to say this.',
    });

    expect(result.ok).toBe(false);
    expect(await rowsFor(fixture.film.id)).toEqual([]);
  });

  it('refuses a save with neither a rating nor words', async () => {
    signInAs(fixture.author);

    const result = await saveReview({
      tmdbId: fixture.film.tmdbId as string,
      rating: null,
      review: '   ',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await rowsFor(fixture.film.id)).toEqual([]);
  });

  it('refuses an unparseable film id', async () => {
    signInAs(fixture.author);

    const result = await saveReview({ tmdbId: 'tt1234', rating: 4, review: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
  });
});

describe('the 0.5-star scale', () => {
  beforeEach(() => {
    signInAs(fixture.author);
  });

  // 🔴 Each of these is a value the source's unvalidated `POST /reviews` would
  // have stored verbatim into an unconstrained `numeric` column.
  it.each([
    ['zero, which is the absence of a rating rather than one', 0],
    ['a third of a star', 2.3],
    ['a quarter step', 4.25],
    ['above five', 5.5],
    ['far above five', 900],
    ['negative', -1],
  ])('rejects %s and writes nothing', async (_name, rating) => {
    const result = await saveReview({
      tmdbId: fixture.film.tmdbId as string,
      rating,
      review: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await rowsFor(fixture.film.id)).toEqual([]);
  });

  it.each([0.5, 1, 2.5, 4.5, 5])('accepts %s and stores it exactly', async (rating) => {
    const result = await saveReview({
      tmdbId: fixture.film.tmdbId as string,
      rating,
      review: null,
    });

    expect(result.ok).toBe(true);
    const rows = await rowsFor(fixture.film.id);
    expect(rows).toHaveLength(1);
    // The column is `Decimal`, so this also pins the repository's conversion:
    // a Decimal instance would fail `toBe`, and 4.5 must not come back as 4 or 5.
    expect(rows[0].rating).toBe(rating);
  });

  it('accepts words with no rating at all', async () => {
    const result = await saveReview({
      tmdbId: fixture.film.tmdbId as string,
      rating: null,
      review: 'Nothing I could put a number on.',
    });

    expect(result.ok).toBe(true);
    const rows = await rowsFor(fixture.film.id);
    expect(rows[0]).toMatchObject({
      rating: null,
      review: 'Nothing I could put a number on.',
    });
  });
});

describe('one review per member per film (R13)', () => {
  beforeEach(() => {
    signInAs(fixture.author);
  });

  it('🔴 the second save edits the first in place rather than adding a row', async () => {
    const tmdbId = fixture.film.tmdbId as string;

    await saveReview({ tmdbId, rating: 2, review: 'A first impression.' });
    const first = await rowsFor(fixture.film.id);

    await saveReview({ tmdbId, rating: 4.5, review: 'I was wrong about it.' });
    const second = await rowsFor(fixture.film.id);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    // Same row id: an update, not a delete-and-insert.
    expect(second[0].id).toBe(first[0].id);
    expect(second[0]).toMatchObject({ rating: 4.5, review: 'I was wrong about it.' });
  });

  it('stores trimmed words, and an empty box as no words rather than ""', async () => {
    const tmdbId = fixture.film.tmdbId as string;

    await saveReview({ tmdbId, rating: 3, review: '  Held up.  ' });
    expect((await rowsFor(fixture.film.id))[0].review).toBe('Held up.');

    await saveReview({ tmdbId, rating: 3, review: '\n  \n' });
    expect((await rowsFor(fixture.film.id))[0].review).toBeNull();
  });

  it('revalidates the film page', async () => {
    const tmdbId = fixture.film.tmdbId as string;
    await saveReview({ tmdbId, rating: 3, review: null });

    expect(revalidatePath.mock.calls.map((call) => call.at(0))).toContain(
      `/films/${tmdbId}`,
    );
  });
});

describe('the same member’s review of a second film', () => {
  const FIRST = { rating: 2, review: 'What I made of the first film.' };
  const SECOND = { rating: 5, review: 'What I made of the second film.' };

  beforeEach(async () => {
    signInAs(fixture.author);
    await saveReview({ tmdbId: fixture.film.tmdbId as string, ...FIRST });
  });

  it('🔴 saving a review of one film leaves the member’s review of another untouched', async () => {
    // Without the `movieId` clause on the upsert's lookup, this second save
    // would find the first film's row and overwrite it: one row, the second
    // film's rating and words filed under the first film.
    await saveReview({ tmdbId: fixture.otherFilm.tmdbId as string, ...SECOND });

    const first = await rowsFor(fixture.film.id);
    const second = await rowsFor(fixture.otherFilm.id);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]).toMatchObject({ userId: fixture.author.id, ...FIRST });
    expect(second[0]).toMatchObject({ userId: fixture.author.id, ...SECOND });
    expect(second[0].id).not.toBe(first[0].id);
  });

  it('🔴 removing one film’s review leaves the member’s other review standing', async () => {
    // Without the `movieId` clause on the delete, this takes every review the
    // member has ever written — caller-visible data loss reported as success.
    await saveReview({ tmdbId: fixture.otherFilm.tmdbId as string, ...SECOND });

    const result = await deleteReview({ tmdbId: fixture.film.tmdbId as string });

    expect(result.ok).toBe(true);
    expect(await rowsFor(fixture.film.id)).toEqual([]);
    const survivors = await rowsFor(fixture.otherFilm.id);
    expect(survivors).toHaveLength(1);
    expect(survivors[0]).toMatchObject({ userId: fixture.author.id, ...SECOND });
  });
});

describe('another member’s review', () => {
  const AUTHOR = { rating: 4.5, review: 'The author wrote this.' };
  const STRANGER = { rating: 1, review: 'The stranger wrote this.' };

  beforeEach(async () => {
    signInAs(fixture.author);
    await saveReview({ tmdbId: fixture.film.tmdbId as string, ...AUTHOR });
  });

  it('🔴 a second member writing about the same film gets their own row', async () => {
    // Without the `userId` clause on the upsert's lookup, the stranger's save
    // would find the author's row and overwrite it: one row, rating 1, the
    // stranger's words under the author's name.
    signInAs(fixture.stranger);

    await saveReview({ tmdbId: fixture.film.tmdbId as string, ...STRANGER });

    const rows = await rowsFor(fixture.film.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.userId === fixture.author.id)).toMatchObject(AUTHOR);
    expect(rows.find((row) => row.userId === fixture.stranger.id)).toMatchObject(
      STRANGER,
    );
  });

  it('🔴 cannot be deleted by anyone else', async () => {
    // The stranger has no review of this film at all, so a delete that filtered
    // on the film alone would take the author's — and report success.
    signInAs(fixture.stranger);

    const result = await deleteReview({ tmdbId: fixture.film.tmdbId as string });

    expect(result.ok).toBe(true);
    const rows = await rowsFor(fixture.film.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: fixture.author.id, ...AUTHOR });
  });

  it('deleting removes the caller’s row and leaves the other standing', async () => {
    signInAs(fixture.stranger);
    await saveReview({ tmdbId: fixture.film.tmdbId as string, ...STRANGER });

    await deleteReview({ tmdbId: fixture.film.tmdbId as string });

    const rows = await rowsFor(fixture.film.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: fixture.author.id, ...AUTHOR });
  });
});

describe('deleting', () => {
  beforeEach(() => {
    signInAs(fixture.author);
  });

  it('refuses an anonymous caller and leaves the row', async () => {
    await saveReview({ tmdbId: fixture.film.tmdbId as string, rating: 3, review: null });
    signInAs(null);

    const result = await deleteReview({ tmdbId: fixture.film.tmdbId as string });

    expect(result.ok).toBe(false);
    expect(await rowsFor(fixture.film.id)).toHaveLength(1);
  });

  it('succeeds for a film the member never reviewed', async () => {
    // Two tabs can disagree for a moment. Reporting a failure there would be a
    // toast about nothing.
    const result = await deleteReview({ tmdbId: fixture.film.tmdbId as string });

    expect(result.ok).toBe(true);
  });
});

describe('a film the app has never cached', () => {
  it('🔴 ingests it, because this is a member deliberately acting', async () => {
    signInAs(fixture.author);
    const tmdbId = '999000222';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: Number(tmdbId),
          title: `${TAG} Uncached Film`,
          imdb_id: 'tt9990002',
          poster_path: '/x.jpg',
          release_date: '2026-07-11',
        }),
      })) as unknown as typeof fetch,
    );
    process.env.TMDB_API_KEY = 'test-tmdb-key';

    try {
      const result = await saveReview({ tmdbId, rating: 5, review: 'Worth the trip.' });

      expect(result.ok).toBe(true);
      const cached = await db.movie.findFirst({
        where: { tmdbId },
        select: { id: true },
      });
      expect(cached).not.toBeNull();
      expect(await rowsFor(cached?.id as number)).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.TMDB_API_KEY;
    }
  });

  it('refuses a film TMDB does not know rather than storing a dangling id', async () => {
    signInAs(fixture.author);
    const before = await db.review.count();

    const result = await saveReview({
      tmdbId: '999999999999',
      rating: 4,
      review: null,
    });

    expect(result.ok).toBe(false);
    expect(await db.review.count()).toBe(before);
  });
});
