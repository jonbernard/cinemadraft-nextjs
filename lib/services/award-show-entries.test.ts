// @vitest-environment node

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getAwardShows } from './award-show';

/**
 * The index page's "Still to enter" answers, end to end through the service:
 * derived from each show's dates and the season's rows (`entry-status.ts`),
 * never from `nom_active`. Seeded, so it runs on CI, on a season of its own.
 */
const TAG = 'entries-test';
const SEASON = 2996;
const HOUR = 3_600_000;
/** 8:00 AM ET on 10 January 2996, as the dates spec splits it. */
const NOM = { nomDate: BigInt(Date.UTC(2996, 0, 10)), nomTime: BigInt(13 * HOUR) };
/** 8:00 PM ET on 1 March 2996 — the 2nd in UTC, so the offset is 25 h. */
const SHOW = { awardsDate: BigInt(Date.UTC(2996, 2, 1)), awardsTime: BigInt(25 * HOUR) };
const AFTER_BOTH = Date.UTC(2996, 3, 1);

async function cleanup() {
  const events = await db.event.findMany({
    where: { abbreviation: { startsWith: TAG } },
    select: { id: true },
  });
  const awards = await db.award.findMany({
    where: { eventId: { in: events.map((event) => event.id) } },
    select: { id: true },
  });
  const awardIds = awards.map((award) => BigInt(award.id));
  await db.winner.deleteMany({ where: { awardId: { in: awardIds } } });
  await db.nomination.deleteMany({ where: { awardId: { in: awardIds } } });
  await db.award.deleteMany({ where: { id: { in: awards.map((award) => award.id) } } });
  await db.event.deleteMany({ where: { id: { in: events.map((event) => event.id) } } });
  await db.movie.deleteMany({ where: { title: { startsWith: `${TAG} ` } } });
}

async function seedShow(
  suffix: string,
  data: { nomActive?: boolean } & Partial<typeof NOM & typeof SHOW>,
) {
  const now = new Date();
  const event = await db.event.create({
    data: {
      name: `${TAG} ${suffix}`,
      abbreviation: `${TAG}-${suffix}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  const categories = await Promise.all(
    ['one', 'two'].map((name) =>
      db.award.create({
        data: { name, eventId: event.id, createdAt: now, updatedAt: now },
        select: { id: true },
      }),
    ),
  );
  return { eventId: event.id, categories: categories.map((category) => category.id) };
}

async function nominate(awardId: number) {
  const now = new Date();
  const movie = await db.movie.create({
    data: {
      title: `${TAG} ${awardId}`,
      sortTitle: `${TAG} ${awardId}`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  const nomination = await db.nomination.create({
    data: {
      movieId: BigInt(movie.id),
      awardId: BigInt(awardId),
      year: SEASON,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  /** Mark this nomination the category's winner. */
  return async function crown() {
    await db.winner.create({
      data: {
        awardId: BigInt(awardId),
        movieId: BigInt(movie.id),
        nominationId: BigInt(nomination.id),
        year: SEASON,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  };
}

async function statusOf(suffix: string, now: number) {
  const shows = await getAwardShows(SEASON, now);
  const show = shows.find((entry) => entry.abbreviation === `${TAG}-${suffix}`);
  return { needsNominations: show?.needsNominations, needsWinners: show?.needsWinners };
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe('getAwardShows — what is still to enter', () => {
  it('ignores nom_active: set but not due, it needs nothing', async () => {
    // 🔴 The flag the port used to read. Nothing sets it now, and a stale
    // `true` must not put a show on the list.
    await seedShow('flagged', { nomActive: true, ...NOM, ...SHOW });

    expect(await statusOf('flagged', Date.UTC(2996, 0, 1))).toEqual({
      needsNominations: false,
      needsWinners: false,
    });
  });

  it('needs nominations once the announcement has passed and none are in', async () => {
    await seedShow('due', { ...NOM });

    expect((await statusOf('due', Date.UTC(2996, 0, 11))).needsNominations).toBe(true);
  });

  it('counts this season’s nominations for the show, across its categories', async () => {
    const { categories } = await seedShow('entered', { ...NOM });
    await nominate(categories[1] as number);

    expect((await statusOf('entered', Date.UTC(2996, 0, 11))).needsNominations).toBe(
      false,
    );
  });

  it('needs winners while a category with nominees has none, and not after', async () => {
    const { categories } = await seedShow('night', { ...NOM, ...SHOW });
    const [first, second] = categories as [number, number];
    await (await nominate(first))();
    const crownSecond = await nominate(second);

    expect(await statusOf('night', AFTER_BOTH)).toEqual({
      needsNominations: false,
      needsWinners: true,
    });

    await crownSecond();
    expect((await statusOf('night', AFTER_BOTH)).needsWinners).toBe(false);
  });
});
