// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { loadMyReview } from './reviews';

/**
 * Reading a review back (P10.T39).
 *
 * 🔴 The source's `GET /reviews/tmdbId/:tmdbId` filtered on the film alone once
 * it had confirmed *somebody* was signed in, so it answered with whichever
 * review Sequelize found first. The author and the reader below therefore hold
 * different ratings and different words: a read that lost its `userId` clause
 * would return a populated review here, not an empty one. The author's two films
 * differ the same way, so a read that lost its `movieId` clause would answer with
 * the wrong film's words.
 */
const TAG = 'review-service';

type Fixture = Awaited<ReturnType<typeof seed>>;

async function createUser(role: string): Promise<number> {
  const now = new Date();
  const user = await db.user.create({
    data: {
      uuid: randomUUID(),
      email: `${TAG}-${role}-${randomUUID().slice(0, 8)}@example.test`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  return user.id;
}

async function seed() {
  const now = new Date();
  const author = await createUser('author');
  const reader = await createUser('reader');

  const [film, otherFilm] = await Promise.all(
    ['Anatomy of a Fall', 'The Zone of Interest'].map((title) =>
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

  await db.review.createMany({
    data: [
      {
        userId: author,
        movieId: film.id,
        rating: 4.5,
        review: 'The author’s own words.',
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: author,
        movieId: otherFilm.id,
        rating: 2,
        review: 'The author on a different film.',
        createdAt: now,
        updatedAt: now,
      },
    ],
  });

  return { author, reader, film, otherFilm };
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
  await cleanup();
  fixture = await seed();
});

afterEach(cleanup);

afterAll(async () => {
  await db.$disconnect();
});

describe('loadMyReview', () => {
  it('returns the caller’s own rating and words', async () => {
    const review = await loadMyReview(fixture.film.tmdbId as string, fixture.author);

    expect(review).toMatchObject({ rating: 4.5, review: 'The author’s own words.' });
  });

  it('🔴 answers with this film’s review, not another the member wrote', async () => {
    const review = await loadMyReview(fixture.otherFilm.tmdbId as string, fixture.author);

    expect(review).toMatchObject({
      rating: 2,
      review: 'The author on a different film.',
    });
  });

  it('🔴 returns null for a member who has not reviewed the film', async () => {
    const review = await loadMyReview(fixture.film.tmdbId as string, fixture.reader);

    expect(review).toBeNull();
  });

  it('returns null for an anonymous reader', async () => {
    expect(await loadMyReview(fixture.film.tmdbId as string, null)).toBeNull();
  });

  it('returns null for a film this app has never cached', async () => {
    expect(await loadMyReview('999000333', fixture.author)).toBeNull();
  });
});
