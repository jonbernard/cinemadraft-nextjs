// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getLeagueSeasons } from './draft';
import {
  compareSeats,
  headToHeadHeadline,
  headToHeadSentence,
  pointsDisagreements,
} from './head-to-head';
import { getLeagueBoardView } from './league-view';

/**
 * 🔴 Restored data: every league 1 season. Excluded on CI
 * (`vitest.ci.config.mts`), which has no league 1. The rules run on a
 * fixture in `head-to-head.test.ts`.
 */
afterAll(async () => {
  await db.$disconnect();
});

const seatsOf = (view: Awaited<ReturnType<typeof getLeagueBoardView>>) =>
  view.groups.flatMap((group) =>
    group.seats.map((seat) => ({ ...seat, group: group.group })),
  );

describe('head-to-head on league 1', () => {
  it('every holder of a film scores it the same, in every season', async () => {
    const seasons = await getLeagueSeasons(1);
    expect(seasons.length).toBeGreaterThanOrEqual(9);
    let shared = 0;
    for (const year of seasons) {
      const seats = seatsOf(await getLeagueBoardView(1, year, null));
      expect(pointsDisagreements(seats), String(year)).toEqual([]);
      const ids = seats.flatMap((seat) => seat.picks.map((pick) => pick.movieId));
      shared += ids.length - new Set(ids).size;
    }
    // Not vacuous: league 1 holds hundreds of films more than once across groups.
    expect(shared).toBeGreaterThan(100);
  });

  it('James Kinney against Micah Baird in 2026 is the proposal’s 415 of 810', async () => {
    const view = await getLeagueBoardView(1, 2026, null);
    const seats = seatsOf(view);
    const james = seats.find((seat) => seat.name === 'James Kinney');
    const micah = seats.find((seat) => seat.name === 'Micah Baird');
    if (!james || !micah) throw new Error('league 1 2026 lacks the measured pair');
    // Read with James as the reader, so he is `a`.
    const h2h = compareSeats(seats, view.standings, james.draftId, micah.draftId);
    expect(h2h?.a).toMatchObject({ name: 'James Kinney', total: 810, position: 9 });
    expect(h2h?.b).toMatchObject({ name: 'Micah Baird', position: 8 });
    expect(h2h?.sharedPoints).toBe(415);
    expect(h2h?.margin).toBe((h2h?.uniqueA ?? 0) - (h2h?.uniqueB ?? 0));
    expect(h2h?.margin).toBe(-25);
    if (!h2h) return;
    expect(headToHeadHeadline(h2h)).toBe('You’re 25 behind Micah Baird');
    expect(headToHeadSentence(h2h)).toBe(
      '415 of your 810 points are films Micah also holds. The gap is the other five picks each.',
    );
  });
});
