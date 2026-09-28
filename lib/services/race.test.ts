import { describe, expect, it } from 'vitest';

import type { Movie } from '@/lib/repositories/movies';
import type { Seat } from './draft';
import type { Moment } from './moments';
import { toRace } from './race';
import type { LedgerLine } from './scoring';
import { buildSeasonLedger } from './season-ledger';

/**
 * The race (P16.T22), on synthetic seats. Pure: runs on CI.
 *
 * Three shows, nominations only, one step each. A (draft order 1) scores 10 at
 * s1; B scores 10 at s2, drawing level, and 10 more at s3, passing A.
 */
const DAY = 86_400_000;
const moment = (n: number, date: number | null): Moment => ({
  key: `${n}-nominations`,
  eventId: n,
  abbreviation: `s${n}`,
  name: `Show ${n}`,
  phase: 'nominations',
  date,
  order: n,
  state: 'finished',
  nominations: 1,
  winners: 0,
});

const line = (eventAbbreviation: string, points: number): LedgerLine => ({
  nominationId: points,
  awardId: points,
  awardName: 'Award',
  eventAbbreviation,
  eventName: eventAbbreviation,
  points,
  won: false,
  earned: points,
});

const seat = (draftId: number, name: string, lines: LedgerLine[]): Seat => {
  const points = lines.reduce((sum, l) => sum + l.earned, 0);
  return {
    draftId,
    userId: draftId + 1000,
    uuid: null,
    name,
    isDummy: false,
    order: draftId,
    picks: [
      {
        pickId: draftId,
        movie: { id: draftId, title: name, poster: null } as unknown as Movie,
        round: 1,
        points,
        ledger: lines,
        createdAt: null,
      },
    ],
    total: points,
  };
};

const SEATS = [
  seat(1, 'A', [line('s1', 10)]),
  seat(2, 'B', [line('s2', 10), line('s3', 12)]),
];
const dated = [moment(1, 100 * DAY), moment(2, 110 * DAY), moment(3, 120 * DAY)];

describe('toRace', () => {
  it('is on the date axis when every step is dated, with the dates as x', () => {
    const race = toRace(buildSeasonLedger(SEATS, dated, null));
    expect(race.axis).toBe('date');
    expect(race.x).toEqual([100 * DAY, 110 * DAY, 120 * DAY]);
  });

  it('is on the order axis when one step is undated, evenly spaced', () => {
    const moments = [dated[0], moment(2, null), dated[2]] as Moment[];
    const race = toRace(buildSeasonLedger(SEATS, moments, null));
    expect(race.axis).toBe('order');
    expect(race.x).toEqual([0, 1, 2]);
  });

  it('counts a lead change only when the leader is passed, not on a tie or the first lead', () => {
    const race = toRace(buildSeasonLedger(SEATS, dated, null));
    // s1: A leads. s2: level, draft order keeps A first. s3: B passes A.
    expect(race.leadChanges).toEqual([
      { stepIndex: 2, from: 'A', to: 'B', moment: dated[2] },
    ]);
    expect(race.leaderAt).toEqual([1, 1, 2]);
  });

  it('ends every line on the seat’s total, in final standings order', () => {
    const race = toRace(buildSeasonLedger(SEATS, dated, 1001));
    expect(race.lines.map((l) => [l.name, l.points])).toEqual([
      ['B', [0, 10, 22]],
      ['A', [10, 10, 10]],
    ]);
    for (const l of race.lines)
      expect(l.points.at(-1)).toBe(SEATS.find((s) => s.draftId === l.draftId)?.total);
    expect(race.lines.map((l) => [l.isLeader, l.isViewer, l.position])).toEqual([
      [true, false, 1],
      [false, true, 2],
    ]);
  });

  it('names the biggest single moments, largest first', () => {
    const race = toRace(buildSeasonLedger(SEATS, dated, null));
    expect(race.biggest.map((b) => [b.name, b.points, b.moment.key])).toEqual([
      ['B', 12, '3-nominations'],
      ['A', 10, '1-nominations'],
      ['B', 10, '2-nominations'],
    ]);
  });

  it('has no steps and no lines’ points before anything scores', () => {
    const upcoming = dated.map((m) => ({ ...m, state: 'upcoming' as const }));
    const race = toRace(buildSeasonLedger(SEATS, upcoming, null));
    expect(race.x).toEqual([]);
    expect(race.lines.every((l) => l.points.length === 0)).toBe(true);
  });
});
