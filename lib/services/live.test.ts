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

  it('carries the ceremony instant and the ceremony day separately', async () => {
    // `awards_date` is UTC midnight of the ceremony day and `awards_time` is
    // milliseconds past it. The countdown needs the sum; the printed date needs
    // the day, and they are NOT the same UTC date — the Oscars store 91,800,000
    // (25.5 hours), because the ceremony is a Sunday evening in America, so the
    // instant lands on the Monday. Formatting the sum in UTC puts the wrong day
    // on the page whose one job is saying when the show starts.
    const view = await getLiveShow('oscars', 2025, null);

    expect(view.startsOn).toBe(1_773_532_800_000);
    expect(view.startsAt).toBe(1_773_532_800_000 + 91_800_000);
    expect(new Date(view.startsOn as number).toISOString()).toBe(
      '2026-03-15T00:00:00.000Z',
    );
    expect(new Date(view.startsAt as number).toISOString()).toBe(
      '2026-03-16T01:30:00.000Z',
    );

    // AFI has no `awards_date` at all in the restored data.
    const unscheduled = await getLiveShow('afi', 2025, null);
    expect(unscheduled.startsAt).toBeNull();
    expect(unscheduled.startsOn).toBeNull();
  });

  it('reports the broadcast window from the row, not from a constant', async () => {
    // `awards_active` is false on all twelve today, and a page that hardcoded
    // `onAir: true` would put a carmine "Live" chip on every show, all year.
    const view = await getLiveShow('oscars', 2025, null);
    expect(view.onAir).toBe(false);
  });

  it('resolves the point value, never the foreign key (D41)', async () => {
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

  it('shows a signed-out reader no leagues, where a member sees real ones', async () => {
    // Same rule as the public dashboard (D44): the signed-out path does not
    // query leagues rather than querying with a sentinel, so there is no code
    // path on which this page can resolve somebody else's team.
    //
    // 🔴 Both halves, deliberately. `expect(leagues).toEqual([])` on its own is
    // a literal compared with itself for as long as nothing produces a seat —
    // it stayed green through all of T16a and could not have failed. The
    // signed-in call is what gives it something to be the absence of.
    const anonymous = await getLiveShow('oscars', 2026, null);
    const member = await getLiveShow('oscars', 2026, 6);

    expect(anonymous.leagues).toEqual([]);
    expect(member.leagues.length).toBeGreaterThan(0);
    expect(member.leagues[0]?.seats.length).toBeGreaterThan(0);
  });

  it("a seat's take is this show's lines only, and the league total adds up", async () => {
    const view = await getLiveShow('oscars', 2026, 6);
    const league = view.leagues[0];
    expect(league).toBeDefined();

    // The league's total is the sum of its seats, never a second reduction —
    // the `MovieLedger` rule. And the seats are ranked by it.
    expect(league?.total).toBe(league?.seats.reduce((sum, seat) => sum + seat.earned, 0));
    const earned = league?.seats.map((seat) => seat.earned) ?? [];
    expect(earned).toEqual([...earned].sort((a, b) => b - a));

    for (const seat of league?.seats ?? []) {
      // Each seat's take is the sum of its films', and every film on this page
      // earned something here — a pick with no line at this show is dropped.
      expect(seat.earned).toBe(seat.films.reduce((sum, film) => sum + film.earned, 0));
      for (const film of seat.films) {
        expect(film.earned).toBeGreaterThan(0);
        expect(film.status).not.toBe('none');
      }
    }

    // 🔴 And it is genuinely narrower than the season. The same seat's dashboard
    // total counts twelve shows; this counts one.
    const viewer = league?.seats.find((seat) => seat.isViewer);
    expect(viewer).toBeDefined();
    expect(viewer?.films.length).toBeGreaterThan(0);
  });

  it('narrows the season ledger to this show and no other', async () => {
    // The whole scoring content of the page is one filter on
    // `LedgerLine.eventAbbreviation`. If it were dropped, every seat would show
    // its season total here — so the two shows would agree, and they must not.
    const oscars = await getLiveShow('oscars', 2026, 6);
    const globes = await getLiveShow('gg', 2026, 6);

    const take = (view: typeof oscars) =>
      view.leagues[0]?.seats.find((seat) => seat.isViewer)?.earned ?? 0;

    expect(take(oscars)).toBeGreaterThan(0);
    expect(take(globes)).toBeGreaterThan(0);
    expect(take(oscars)).not.toBe(take(globes));
  });

  it('throws NotFoundError for a show that does not exist', async () => {
    await expect(getLiveShow('not-a-show', 2025, null)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
