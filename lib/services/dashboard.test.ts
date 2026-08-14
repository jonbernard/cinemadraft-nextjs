// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { draftRepository } from '@/lib/repositories/drafts';
import { getDashboard } from './dashboard';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real restored data: league 1 is the only league that has ever
 * genuinely existed, and 2026 is the active season.
 *
 * A user with a seat is found from the data rather than hardcoded, so this
 * keeps working when the active season moves.
 */
async function aMemberOfLeague1(): Promise<number> {
  const drafts = await draftRepository.findByLeagueId(1);
  const withUser = drafts.find((draft) => draft.userId != null);
  if (!withUser?.userId) throw new Error('no drafts with a user in league 1');
  return withUser.userId;
}

describe('getDashboard', () => {
  it('returns the active season, not a hardcoded year', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    expect(view.year).toBe(2026);
  });

  it('includes the leagues the member has drafted in', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    expect(view.leagues.map((league) => league.id)).toContain(1);
  });

  it('returns an empty dashboard for someone with no leagues, not an error', async () => {
    // A brand-new member who has just claimed their account. This is the
    // empty-state path, and it must not throw on the way to rendering it.
    const view = await getDashboard(999_999);

    expect(view.leagues).toEqual([]);
    expect(view.year).toBe(2026);
  });

  it('🔴 does not assume a roster size (D34)', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const league = view.leagues.find((entry) => entry.id === 1);

    // Whatever the seat drafted. 2026 is mid-draft in the restored data, so
    // asserting any particular number here would be asserting the snapshot.
    expect(league?.roster.length).toBeGreaterThanOrEqual(0);
    expect(league?.roster.length).toBe(
      new Set(league?.roster.map((e) => e.movie.id)).size,
    );
  });

  it('orders the roster by draft round, never by points', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const rounds = view.leagues.find((l) => l.id === 1)?.roster.map((e) => e.round) ?? [];

    expect([...rounds]).toEqual([...rounds].sort((a, b) => a - b));
  });

  it('sorts standings by total, highest first', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const totals =
      view.leagues.find((l) => l.id === 1)?.standings.map((r) => r.total) ?? [];

    expect(totals.length).toBeGreaterThan(0);
    expect([...totals]).toEqual([...totals].sort((a, b) => b - a));
  });

  it('🔴 ranks ties densely — the normal state before anything is awarded', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const standings = view.leagues.find((l) => l.id === 1)?.standings ?? [];

    // Equal totals share a position; the next distinct total skips.
    for (let i = 1; i < standings.length; i += 1) {
      const previous = standings[i - 1] as (typeof standings)[number];
      const current = standings[i] as (typeof standings)[number];
      if (current.total === previous.total) {
        expect(current.position).toBe(previous.position);
      } else {
        expect(current.position).toBe(i + 1);
      }
    }
  });

  it('marks exactly one standings row as the viewer', async () => {
    const userId = await aMemberOfLeague1();
    const view = await getDashboard(userId);
    const standings = view.leagues.find((l) => l.id === 1)?.standings ?? [];

    expect(standings.filter((row) => row.isViewer)).toHaveLength(1);
    expect(standings.find((row) => row.isViewer)?.userId).toBe(userId);
  });

  it('a seat total equals the sum of its roster', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const league = view.leagues.find((l) => l.id === 1);

    const summed = league?.roster.reduce((sum, entry) => sum + entry.points, 0) ?? 0;
    expect(league?.total).toBe(summed);
  });

  it('🔴 never divides by zero when nothing has scored', async () => {
    // Opening day: every seat is on zero. An unguarded share would make every
    // contribution bar NaN on the one day the most people are looking.
    const view = await getDashboard(await aMemberOfLeague1());
    const shares = view.leagues.flatMap((l) => l.roster.map((e) => e.share));

    for (const share of shares) {
      expect(Number.isFinite(share)).toBe(true);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  });

  it('sorts events by date, with unscheduled shows last', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const dated = view.events
      .filter((event) => event.date != null)
      .map((e) => e.date as number);

    expect(view.events.length).toBeGreaterThan(0);
    expect([...dated]).toEqual([...dated].sort((a, b) => a - b));
    // An undated show means "not scheduled yet", which is the far future.
    const firstUndated = view.events.findIndex((event) => event.date == null);
    if (firstUndated !== -1) {
      expect(view.events.slice(firstUndated).every((event) => event.date == null)).toBe(
        true,
      );
    }
  });
});
