// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { getLiveShow } from './live';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real restored data. The live page composes `getAwardShow` and
 * `getLeagueBoard` and adds no scoring of its own (D19/D41), so what these pin
 * is the composition: the schedule, the progress counters, the resolved point
 * value, and the signed-out path that makes the route safe to make public.
 */
describe('getLiveShow', () => {
  it('returns the show, its schedule and how far through it is', async () => {
    const view = await getLiveShow('oscars', 2025, null);

    expect(view.abbreviation).toBe('oscars');
    expect(view.total).toBe(view.categories.length);
    expect(view.resolved).toBe(
      view.categories.filter((category) => category.winner != null).length,
    );
    expect(view.resolved).toBeLessThanOrEqual(view.total);
    // 🔴 Not just "equal to whatever the mapping produced" — the counters are
    // the page's headline and both sides of the equalities above are computed
    // from the same array. These say the array is not empty and the season
    // genuinely resolved, which is what 2025 in the restored data looks like.
    expect(view.total).toBeGreaterThan(20);
    expect(view.resolved).toBeGreaterThan(0);
  });

  it('carries the ceremony start as one instant', async () => {
    // `awards_date` is UTC midnight of the ceremony day and `awards_time` is
    // milliseconds past it; the page needs the sum, and a show with no date
    // needs null rather than a countdown to midnight on the 1st of January 1970.
    const view = await getLiveShow('oscars', 2025, null);
    expect(view.startsAt).toBe(1_773_532_800_000 + 91_800_000);

    // AFI has no `awards_date` at all in the restored data.
    const unscheduled = await getLiveShow('afi', 2025, null);
    expect(unscheduled.startsAt).toBeNull();
  });

  it('🔴 resolves the point value, never the foreign key (D41)', async () => {
    // `awards.points` is an FK into `points.id`. "Performance by an Ensemble"
    // stores 1 and is worth 5. This page is one a reader would check a score
    // against, so a confident wrong number here is the worst kind.
    const view = await getLiveShow('sag', 2025, null);
    const ensemble = view.categories.find((c) => /ensemble/i.test(c.name));
    // 🔴 Not `if (ensemble)` as the plan drafted it: an assertion behind an
    // `if` over data that might not match is a test that cannot fail. The row
    // exists in the restored corpus, so the lookup itself is the assertion.
    expect(ensemble).toBeDefined();
    expect(ensemble?.points).toBeGreaterThan(1);
  });

  it('names the winning film once a category has one', async () => {
    const view = await getLiveShow('oscars', 2025, null);
    const won = view.categories.filter((category) => category.winner != null);
    expect(won.length).toBeGreaterThan(0);
    for (const category of won) {
      expect(category.winner?.title).not.toBe('');
      expect(category.nomineeCount).toBeGreaterThan(0);
    }
  });

  it('shows a signed-out reader no leagues at all', async () => {
    // Same rule as the public dashboard (D44): the signed-out path does not
    // query leagues rather than querying with a sentinel, so there is no code
    // path on which this page can resolve somebody else's team.
    const view = await getLiveShow('oscars', 2025, null);
    expect(view.leagues).toEqual([]);
  });

  it('throws NotFoundError for a show that does not exist', async () => {
    await expect(getLiveShow('not-a-show', 2025, null)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
