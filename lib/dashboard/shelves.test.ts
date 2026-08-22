import { describe, expect, it } from 'vitest';

import type { LeagueView, RosterEntry } from '@/lib/services/dashboard';
import { recentPicks, SHELF_LIMIT, topScorers } from './shelves';

/**
 * The dashboard's lower fold is the one place in this sweep that adds content
 * rather than restyling it, so its ranking is the one piece of new logic —
 * dedupe across leagues, the cap, the rescaled contribution bar, and two
 * different orderings. All of it is pure, so all of it is pinned here.
 */

/**
 * A roster entry with only the fields the shelves read filled in.
 *
 * `share` is set to a deliberately wrong-looking value so a test that started
 * passing it through instead of rescaling would be obvious.
 */
function entry(
  id: number,
  {
    title = `Film ${id}`,
    points = 0,
    round = 1,
    pickedAt = null,
  }: Partial<{
    title: string | null;
    points: number;
    round: number;
    pickedAt: number | null;
  }> = {},
): RosterEntry {
  return {
    movie: { id, title } as RosterEntry['movie'],
    round,
    points,
    share: 0.99,
    pickedAt,
  };
}

/** A league carrying nothing the shelves read except its roster. */
function league(roster: RosterEntry[]): LeagueView {
  return {
    id: roster.length,
    name: 'A league',
    roster,
    total: 0,
    standings: [],
    position: null,
  };
}

describe('topScorers', () => {
  it('ranks by points, highest first', () => {
    const shelf = topScorers([
      league([entry(1, { points: 3 }), entry(2, { points: 9 }), entry(3, { points: 5 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([2, 3, 1]);
  });

  it('leaves out films that have not scored', () => {
    const shelf = topScorers([
      league([entry(1, { points: 0 }), entry(2, { points: 4 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([2]);
    // The eyebrow's two numbers: two films held, one of them scoring.
    expect(shelf.held).toBe(2);
    expect(shelf.matching).toBe(1);
  });

  it('is empty before anything has scored, so the page can render nothing', () => {
    const shelf = topScorers([league([entry(1), entry(2)])]);

    expect(shelf.films).toEqual([]);
    expect(shelf.matching).toBe(0);
    expect(shelf.held).toBe(2);
  });

  it('is empty for a viewer with no leagues', () => {
    expect(topScorers([])).toEqual({ held: 0, matching: 0, films: [] });
  });

  it('counts a film held in two leagues once', () => {
    const shelf = topScorers([
      league([entry(1, { points: 7, pickedAt: 100 })]),
      league([entry(1, { points: 7, pickedAt: 200 }), entry(2, { points: 2 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([1, 2]);
    expect(shelf.held).toBe(2);
  });

  it('rescales the contribution bar against the best film on the shelf', () => {
    const shelf = topScorers([
      league([
        entry(1, { points: 10 }),
        entry(2, { points: 5 }),
        entry(3, { points: 1 }),
      ]),
    ]);

    // Not the 0.99 `share` the entries carry: that is a share of one seat's
    // total, which is meaningless once two leagues are on one shelf.
    expect(shelf.films.map((film) => film.share)).toEqual([1, 0.5, 0.1]);
  });

  it('caps the shelf but not the count the eyebrow reports', () => {
    const many = Array.from({ length: SHELF_LIMIT + 5 }, (_, index) =>
      entry(index + 1, { points: index + 1 }),
    );
    const shelf = topScorers([league(many)]);

    expect(shelf.films).toHaveLength(SHELF_LIMIT);
    expect(shelf.matching).toBe(SHELF_LIMIT + 5);
    expect(shelf.held).toBe(SHELF_LIMIT + 5);
  });

  it('breaks a tie on film id, so the order is total', () => {
    const shelf = topScorers([
      league([entry(9, { points: 4 }), entry(2, { points: 4 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([2, 9]);
  });

  it('falls back to Untitled rather than printing nothing', () => {
    const shelf = topScorers([league([entry(1, { title: null, points: 1 })])]);

    expect(shelf.films[0]?.title).toBe('Untitled');
  });
});

describe('recentPicks', () => {
  it('orders by pick time, newest first', () => {
    const shelf = recentPicks([
      league([
        entry(1, { pickedAt: 300 }),
        entry(2, { pickedAt: 100 }),
        entry(3, { pickedAt: 200 }),
      ]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([1, 3, 2]);
  });

  it('interleaves two leagues by time rather than grouping them', () => {
    const shelf = recentPicks([
      league([entry(1, { pickedAt: 500 }), entry(2, { pickedAt: 100 })]),
      league([entry(3, { pickedAt: 300 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([1, 3, 2]);
  });

  it('keeps films that have not scored — recency is not performance', () => {
    const shelf = recentPicks([
      league([entry(1, { pickedAt: 200 }), entry(2, { points: 6, pickedAt: 100 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([1, 2]);
    expect(shelf.matching).toBe(2);
  });

  it('sorts an untimed pick last rather than to the epoch', () => {
    const shelf = recentPicks([
      league([entry(1, { pickedAt: null }), entry(2, { pickedAt: 100 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([2, 1]);
  });

  it('orders untimed picks by round, latest round first', () => {
    const shelf = recentPicks([
      league([
        entry(1, { pickedAt: null, round: 2 }),
        entry(2, { pickedAt: null, round: 7 }),
        entry(3, { pickedAt: null, round: 5 }),
      ]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([2, 3, 1]);
  });

  it('keeps the newer of two picks of the same film', () => {
    const shelf = recentPicks([
      league([entry(1, { pickedAt: 100, round: 8 })]),
      league([entry(1, { pickedAt: 900, round: 1 }), entry(2, { pickedAt: 500 })]),
    ]);

    expect(shelf.films.map((film) => film.id)).toEqual([1, 2]);
    expect(shelf.held).toBe(2);
  });

  it('never lets an untimed duplicate displace a timed one', () => {
    const shelf = recentPicks([
      league([entry(1, { pickedAt: 100 })]),
      league([entry(1, { pickedAt: null }), entry(2, { pickedAt: 50 })]),
    ]);

    // The timed copy survives, so film 1 still sorts ahead of film 2.
    expect(shelf.films.map((film) => film.id)).toEqual([1, 2]);
  });

  it('leaves every bar at zero when nothing on the shelf has scored', () => {
    const shelf = recentPicks([
      league([entry(1, { pickedAt: 200 }), entry(2, { pickedAt: 100 })]),
    ]);

    expect(shelf.films.map((film) => film.share)).toEqual([0, 0]);
  });

  it('is empty for a viewer with no leagues', () => {
    expect(recentPicks([])).toEqual({ held: 0, matching: 0, films: [] });
  });
});
