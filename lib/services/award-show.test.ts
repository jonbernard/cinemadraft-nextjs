// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { getAwardShow, getAwardShows } from './award-show';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real restored data: 12 shows, 100 categories, 4,559 nominations,
 * 734 winners.
 *
 * This is the page the scoring pipeline reads from, so what matters most here
 * is that the numbers on it are the numbers scoring uses.
 */
describe('getAwardShows', () => {
  it('lists every show with its category count', async () => {
    const shows = await getAwardShows();

    expect(shows).toHaveLength(12);
    const oscars = shows.find((show) => show.abbreviation === 'oscars');
    expect(oscars?.name).toBe('Academy of Motion Picture Arts and Sciences');
    expect(oscars?.categoryCount).toBeGreaterThan(0);
  });
});

describe('getAwardShow', () => {
  it('returns the show, its categories and its nominees', async () => {
    const show = await getAwardShow('oscars', 2025);

    expect(show.abbreviation).toBe('oscars');
    expect(show.year).toBe(2025);
    expect(show.categories.length).toBeGreaterThan(0);
    expect(show.categories.some((category) => category.nominees.length > 0)).toBe(true);
  });

  it('🔴 resolves the point value through pointsId, never the raw column', async () => {
    // `awards.points` is a foreign key into `points.id` (D41). Measured in the
    // real data: "Best Picture" stores 9 and is worth 20; the acting
    // categories store 8 and are worth 15. A page printing the column would
    // show a confident wrong number, and this is the page a member would check
    // it on.
    const show = await getAwardShow('oscars', 2025);
    const bestPicture = show.categories.find((c) => c.name === 'Best Picture');

    expect(bestPicture?.points).toBe(20);
  });

  it('🔴 agrees with what scoring awards for the same category', async () => {
    // The page and the standings must not be able to disagree. If this ever
    // fails, one of them is lying to the league.
    const show = await getAwardShow('oscars', 2025);
    const withPoints = show.categories.filter((category) => category.points > 0);

    const rows = await db.award.findMany({
      where: { id: { in: withPoints.map((category) => category.awardId) } },
      select: { id: true, points: true },
    });
    const values = await db.point.findMany({
      where: {
        id: { in: rows.flatMap((row) => (row.points == null ? [] : [row.points])) },
      },
      select: { id: true, points: true },
    });
    const valueById = new Map(values.map((value) => [value.id, value.points]));

    for (const category of withPoints) {
      const row = rows.find((entry) => entry.id === category.awardId);
      expect(category.points).toBe(valueById.get(row?.points as number));
    }
  });

  it('sorts categories by name', async () => {
    const show = await getAwardShow('oscars', 2025);
    const names = show.categories.map((category) => category.name);

    expect([...names]).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('marks the winner of a category, and only the winner', async () => {
    const show = await getAwardShow('oscars', 2025);
    const decided = show.categories.find((category) => category.hasWinner);

    expect(decided).toBeDefined();
    const winners = decided?.nominees.filter((nominee) => nominee.isWinner) ?? [];
    expect(winners.length).toBeGreaterThan(0);
  });

  it('carries the nominated person where the category names one', async () => {
    // Without this an acting category renders as four identical posters of the
    // same film.
    const show = await getAwardShow('oscars', 2025);
    const acting = show.categories.find((category) => category.requiresNomineeName);

    expect(acting).toBeDefined();
    expect(acting?.nominees.some((nominee) => nominee.detailName != null)).toBe(true);
  });

  it('builds poster urls the grid can load', async () => {
    const show = await getAwardShow('oscars', 2025);
    const withArt = show.categories
      .flatMap((category) => category.nominees)
      .find((nominee) => nominee.posterUrl != null);

    expect(withArt?.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w185\//);
  });

  it('returns a show with empty categories for a season it has no data for', async () => {
    // Not an error: a show exists every year whether or not anyone has entered
    // its nominations yet.
    const show = await getAwardShow('oscars', 1999);

    expect(show.categories.every((category) => category.nominees.length === 0)).toBe(
      true,
    );
  });

  it('🔴 throws for a show that does not exist rather than rendering an empty one', async () => {
    // The page turns this into a 404. An empty show would look like a real one
    // nobody has entered yet — a state that genuinely occurs, per the test
    // above, so the two must not look alike.
    await expect(getAwardShow('not-a-show', 2025)).rejects.toBeInstanceOf(NotFoundError);
  });
});
