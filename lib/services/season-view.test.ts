// @vitest-environment node

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';

/**
 * The season view (P16.T15), end to end through the service on a scratch show
 * of its own in 2989. Seeded, so it runs on CI. The active year is mocked, so
 * the off-season rule can be driven without touching `available_years`.
 */
const TAG = 'season-view-test';
const YEAR = 2989;
const activeYear = vi.hoisted(() => ({ value: 2989 }));

vi.mock('@/lib/services/season', async (real) => ({
  ...(await real<typeof import('@/lib/services/season')>()),
  getActiveYear: vi.fn(async () => activeYear.value),
}));

import { getSeasonView, UP_NEXT_FILMS } from './season-view';

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

/**
 * A show with nominations on 10 Jan and a ceremony on 1 Mar 2989: ten films
 * nominated in one category, and the first of them in a second one too.
 */
async function seed({ nominations = true } = {}) {
  const now = new Date();
  const event = await db.event.create({
    data: {
      name: `${TAG} Show`,
      abbreviation: `${TAG}-show`,
      nomDate: BigInt(Date.UTC(YEAR, 0, 10)),
      awardsDate: BigInt(Date.UTC(YEAR, 2, 1)),
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  const [picture, director] = await Promise.all(
    ['Picture', 'Director'].map((name) =>
      db.award.create({
        data: { name, eventId: event.id, createdAt: now, updatedAt: now },
        select: { id: true },
      }),
    ),
  );
  const films = [];
  for (let i = 0; i < 10; i += 1) {
    const title = `${TAG} ${String(i).padStart(2, '0')}`;
    films.push(
      await db.movie.create({
        data: {
          title,
          sortTitle: title,
          tmdbId: String(9_990_000 + i),
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true },
      }),
    );
  }
  const nominate = (movieId: number, awardId: number) =>
    db.nomination.create({
      data: {
        movieId: BigInt(movieId),
        awardId: BigInt(awardId),
        year: YEAR,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
  if (!nominations) return { eventId: event.id };
  for (const film of films) await nominate(film.id, picture?.id as number);
  await nominate(films[0]?.id as number, director?.id as number);
  return { eventId: event.id };
}

beforeEach(async () => {
  activeYear.value = YEAR;
  await cleanup();
});
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe('getSeasonView', () => {
  it('groups dated moments by month, and puts undated ones last', async () => {
    const { eventId } = await seed();
    const view = await getSeasonView(YEAR);

    expect(view).toMatchObject({ year: YEAR, offSeason: false, activeYear: YEAR });
    const labels = view.months.map((month) => month.label);
    const monthOf = (key: string) =>
      view.months.find((month) => month.moments.some((m) => m.key === key))?.label;
    expect(monthOf(`${eventId}-nominations`)).toBe('January 2989');
    expect(monthOf(`${eventId}-ceremony`)).toBe('March 2989');
    expect(labels.indexOf('January 2989')).toBeLessThan(labels.indexOf('March 2989'));
    // Every other show in the table holds another season's dates.
    const last = labels.at(-1);
    if (labels.length > 2) expect(last).toBe('Not yet scheduled');
  });

  it('says what a finished nominations moment did: the count and the most-nominated film', async () => {
    const { eventId } = await seed();
    const view = await getSeasonView(YEAR);
    const moment = view.months
      .flatMap((month) => month.moments)
      .find((m) => m.key === `${eventId}-nominations`);
    expect(moment).toMatchObject({
      state: 'finished',
      nominations: 11,
      categories: 2,
      highlight: { title: `${TAG} 00`, count: 2 },
    });
  });

  it('names no headline film when none stands out', async () => {
    await seed();
    const now = new Date();
    const event = await db.event.create({
      data: {
        name: `${TAG} Flat`,
        abbreviation: `${TAG}-flat`,
        nomDate: BigInt(Date.UTC(YEAR, 0, 12)),
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
    const award = await db.award.create({
      data: { name: 'Flat', eventId: event.id, createdAt: now, updatedAt: now },
      select: { id: true },
    });
    const films = await db.movie.findMany({
      where: { title: { in: [`${TAG} 01`, `${TAG} 02`] } },
      select: { id: true },
    });
    for (const film of films)
      await db.nomination.create({
        data: {
          movieId: BigInt(film.id),
          awardId: BigInt(award.id),
          year: YEAR,
          createdAt: now,
          updatedAt: now,
        },
      });
    const view = await getSeasonView(YEAR);
    const flat = view.months
      .flatMap((m) => m.moments)
      .find((m) => m.key === `${event.id}-nominations`);
    expect(flat).toMatchObject({ state: 'finished', nominations: 2, highlight: null });
  });

  it(`caps Up next at ${UP_NEXT_FILMS} films, and counts the rest`, async () => {
    const { eventId } = await seed();
    const view = await getSeasonView(YEAR);
    expect(view.next?.key).toBe(`${eventId}-ceremony`);
    expect(view.next?.films).toHaveLength(8);
    expect(view.next?.more).toBe(10 - 8);
    expect(view.next?.films[0]).toEqual({
      title: `${TAG} 00`,
      tmdbId: '9990000',
      count: 2,
    });
  });

  it('off-season: a year with no dates and no nominations shows the one before it', async () => {
    await seed();
    activeYear.value = YEAR + 1;
    const view = await getSeasonView(null);
    expect(view).toMatchObject({ year: YEAR, offSeason: true, activeYear: YEAR + 1 });
  });

  it('shows the active year while it has dates, even before any nominations', async () => {
    await seed({ nominations: false });
    const view = await getSeasonView(null);
    expect(view).toMatchObject({ year: YEAR, offSeason: false });
  });
});
