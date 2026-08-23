// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { parseComponents, profileFeedRepository } from '@/lib/repositories/profile-feeds';
import { loadMemberProfile, loadProfileMember } from './profile';

/**
 * A member's profile and activity feed (P10.T40).
 *
 * `profile_feeds` holds 125 restored rows, so nothing here may read the table
 * unqualified: every row this file touches is seeded under a uuid minted for the
 * run and removed after it. It seeds what it reads, so it runs on CI.
 *
 * 🔴 **Two members, and everything about them differs.** The feed is scoped by
 * `user_uuid` and the profile is about the member in the URL; a query that lost
 * either clause would still return rows of the right shape, so alpha's and
 * beta's messages, reviews and ratings are chosen so that a broken read
 * produces a value no assertion here accepts.
 */
const TAG = 'profile-service';

type Fixture = Awaited<ReturnType<typeof seed>>;

/** Ordered so that `createdAt desc` and `id desc` disagree about every pair. */
const NEWEST = new Date('2026-03-04T00:00:00.000Z');
const TIED = new Date('2026-02-02T00:00:00.000Z');
const OLDEST = new Date('2026-01-01T00:00:00.000Z');

async function createUser(role: string) {
  const now = new Date();
  return db.user.create({
    data: {
      uuid: randomUUID(),
      firstName: `${TAG}-${role}`,
      email: `${TAG}-${role}-${randomUUID().slice(0, 8)}@example.test`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, uuid: true },
  });
}

async function createFilm(title: string) {
  const now = new Date();
  return db.movie.create({
    data: {
      title: `${TAG} ${title}`,
      sortTitle: `${TAG} ${title}`,
      tmdbId: `9${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
      poster: '/poster.jpg',
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, tmdbId: true },
  });
}

async function seed() {
  const now = new Date();
  const alpha = await createUser('alpha');
  const beta = await createUser('beta');

  const draft = await db.draft.create({
    data: { userId: alpha.id, year: 2099, createdAt: now, updatedAt: now },
    select: { id: true },
  });

  // Seven, so the five-poster cap has two films to leave out.
  const films = [];
  for (const title of ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']) {
    films.push(await createFilm(title));
  }
  let order = 0;
  for (const film of films) {
    await db.draftPick.create({
      data: {
        draftId: draft.id,
        movieId: film.id,
        userId: alpha.id,
        order: order++,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const alphaReview = await db.review.create({
    data: {
      userId: alpha.id,
      movieId: films[0].id,
      rating: 4.5,
      review: 'alpha wrote this',
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  const betaReview = await db.review.create({
    data: {
      userId: beta.id,
      movieId: films[1].id,
      rating: 1,
      review: 'beta wrote this',
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });

  // Insertion order is the opposite of the expected order, so neither sort key
  // can be dropped without the list coming back differently.
  const newest = await addRow(alpha.uuid, 'alpha newest', NEWEST);
  const tiedFirst = await addRow(alpha.uuid, 'alpha tied first', TIED);
  const tiedSecond = await addRow(alpha.uuid, 'alpha tied second', TIED);
  const oldest = await addRow(alpha.uuid, 'alpha oldest', OLDEST);
  await addRow(beta.uuid, 'beta only', NEWEST);

  return {
    alpha,
    beta,
    draft,
    films,
    alphaReview,
    betaReview,
    rows: { newest, tiedFirst, tiedSecond, oldest },
  };
}

async function addRow(userUuid: string | null, message: string, createdAt: Date) {
  const row = await db.profileFeed.create({
    data: {
      userUuid,
      message,
      components: '[]',
      createdAt,
      updatedAt: createdAt,
    },
    select: { id: true },
  });
  return row.id;
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { contains: `${TAG}-` } },
    select: { id: true, uuid: true },
  });
  const films = await db.movie.findMany({
    where: { title: { startsWith: `${TAG} ` } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  const uuids = users.flatMap((user) => (user.uuid === null ? [] : [user.uuid]));

  await db.profileFeed.deleteMany({ where: { userUuid: { in: uuids } } });
  await db.review.deleteMany({ where: { userId: { in: ids } } });
  await db.draftPick.deleteMany({ where: { userId: { in: ids } } });
  await db.draft.deleteMany({ where: { userId: { in: ids } } });
  await db.movie.deleteMany({ where: { id: { in: films.map((film) => film.id) } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
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

describe('parseComponents', () => {
  it('reads the legacy double-escaped spelling (trap 6)', () => {
    expect(parseComponents('[[\\"draft\\",9]]')).toEqual([['draft', 9]]);
  });

  it('reads the current spelling', () => {
    expect(parseComponents('[["draft",110]]')).toEqual([['draft', 110]]);
  });

  it('returns no components for null rather than throwing, as the source getter did', () => {
    expect(parseComponents(null)).toEqual([]);
  });
});

describe('the components round trip', () => {
  it('writes a string parseComponents reads back', async () => {
    const written = await profileFeedRepository.create({
      userUuid: fixture.alpha.uuid as string,
      message: 'alpha round trip',
      components: [
        ['draft', fixture.draft.id],
        ['review', fixture.alphaReview.id],
      ],
    });

    expect(written.components).toBe(
      `[["draft",${fixture.draft.id}],["review",${fixture.alphaReview.id}]]`,
    );

    const [read] = (
      await profileFeedRepository.findByUserUuid(fixture.alpha.uuid as string)
    ).filter((row) => row.id === written.id);

    expect(read.componentsArray).toEqual([
      ['draft', fixture.draft.id],
      ['review', fixture.alphaReview.id],
    ]);
  });
});

describe('loadMemberProfile', () => {
  it('🔴 returns only the feed of the member in the URL', async () => {
    const profile = await loadMemberProfile(fixture.alpha.uuid as string);

    expect(profile?.feed.map((item) => item.message)).toEqual([
      'alpha newest',
      'alpha tied second',
      'alpha tied first',
      'alpha oldest',
    ]);
  });

  it('orders newest first, breaking ties on id', async () => {
    const profile = await loadMemberProfile(fixture.alpha.uuid as string);

    expect(profile?.feed.map((item) => item.id)).toEqual([
      fixture.rows.newest,
      fixture.rows.tiedSecond,
      fixture.rows.tiedFirst,
      fixture.rows.oldest,
    ]);
  });

  it('names the member and does not fall back to their email', async () => {
    const profile = await loadMemberProfile(fixture.alpha.uuid as string);

    expect(profile?.member.name).toBe(`${TAG}-alpha`);
    expect(profile?.member.uuid).toBe(fixture.alpha.uuid);
  });

  it('is null for a uuid nobody has', async () => {
    expect(await loadMemberProfile(randomUUID())).toBeNull();
  });

  it('🔴 is null for a value Postgres cannot parse as a uuid', async () => {
    // `users.uuid` is `@db.Uuid`; without the guard this raises out of the
    // driver and the route renders an error instead of a 404.
    expect(await loadMemberProfile('not-a-uuid')).toBeNull();
    expect(await loadProfileMember('not-a-uuid')).toBeNull();
  });

  it('resolves a draft component to the seat’s films, capped at five', async () => {
    const row = await profileFeedRepository.create({
      userUuid: fixture.alpha.uuid as string,
      message: 'alpha drafted these',
      components: [['draft', fixture.draft.id]],
    });

    const profile = await loadMemberProfile(fixture.alpha.uuid as string);
    const item = profile?.feed.find((entry) => entry.id === row.id);
    const attachment = item?.attachments[0];

    expect(attachment?.kind).toBe('draft');
    if (attachment?.kind !== 'draft') throw new Error('expected a draft attachment');
    expect(attachment.films.map((film) => film.title)).toEqual([
      `${TAG} One`,
      `${TAG} Two`,
      `${TAG} Three`,
      `${TAG} Four`,
      `${TAG} Five`,
    ]);
    expect(attachment.more).toBe(2);
    expect(attachment.films[0].posterUrl).toBe(
      'https://image.tmdb.org/t/p/w185/poster.jpg',
    );
  });

  it('drops a component whose kind it does not know', async () => {
    const row = await profileFeedRepository.create({
      userUuid: fixture.alpha.uuid as string,
      message: 'alpha did something new',
      components: [['podcast', 1]],
    });

    const profile = await loadMemberProfile(fixture.alpha.uuid as string);
    expect(profile?.feed.find((entry) => entry.id === row.id)?.attachments).toEqual([]);
  });

  it('resolves the member’s own review component', async () => {
    const row = await profileFeedRepository.create({
      userUuid: fixture.alpha.uuid as string,
      message: 'alpha posted a review',
      components: [['review', fixture.alphaReview.id]],
    });

    const profile = await loadMemberProfile(fixture.alpha.uuid as string);
    const attachment = profile?.feed.find((entry) => entry.id === row.id)?.attachments[0];

    if (attachment?.kind !== 'review') throw new Error('expected a review attachment');
    expect(attachment.review).toBe('alpha wrote this');
    expect(attachment.rating).toBe(4.5);
  });

  it('🔴 refuses to render another member’s review under this member’s name', async () => {
    const row = await profileFeedRepository.create({
      userUuid: fixture.alpha.uuid as string,
      message: 'alpha posted a review',
      components: [['review', fixture.betaReview.id]],
    });

    const profile = await loadMemberProfile(fixture.alpha.uuid as string);
    const item = profile?.feed.find((entry) => entry.id === row.id);

    expect(item?.attachments).toEqual([]);
    expect(JSON.stringify(profile)).not.toContain('beta wrote this');
  });
});
