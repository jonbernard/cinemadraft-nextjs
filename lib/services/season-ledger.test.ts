import { describe, expect, it } from 'vitest';

import type { Movie } from '@/lib/repositories/movies';
import type { Seat } from './draft';
import type { Moment } from './moments';
import type { LedgerLine } from './scoring';
import { buildSeasonLedger } from './season-ledger';

/**
 * Each seat's season by moment (P16.T14), on synthetic seats. Pure: runs on CI.
 *
 * Three seats in draft order A (10), B (11), C (12). Two shows: the Oscars,
 * with a ceremony, and a show with none (the AFI shape, D129). A and C both
 * hold film X, which carries a D125 pair: two nominations in one category,
 * one of which wins (3P). B holds Y, whose AFI line is a stray win on a show
 * with no ceremony.
 */
const moment = (
  eventId: number,
  abbreviation: string,
  phase: Moment['phase'],
  order: number,
  state: Moment['state'] = 'finished',
): Moment => ({
  key: `${eventId}-${phase}`,
  eventId,
  abbreviation,
  name: abbreviation,
  phase,
  date: null,
  order,
  state,
  nominations: 1,
  winners: phase === 'ceremony' ? 1 : 0,
});

const MOMENTS: Moment[] = [
  moment(2, 'afi', 'nominations', 1),
  moment(1, 'oscars', 'nominations', 2),
  moment(1, 'oscars', 'ceremony', 3),
  moment(3, 'bafta', 'nominations', 4, 'upcoming'),
  moment(3, 'bafta', 'ceremony', 5, 'upcoming'),
];

let nominationId = 0;
const line = (eventAbbreviation: string, points: number, won = false): LedgerLine => ({
  nominationId: ++nominationId,
  awardId: points,
  awardName: `Award ${points}`,
  eventAbbreviation,
  eventName: eventAbbreviation,
  points,
  won,
  earned: won ? points * 2 : points,
});

const film = (id: number, title: string, lines: LedgerLine[]) => ({
  pickId: id,
  movie: { id, title, poster: null, tmdbId: String(id) } as unknown as Movie,
  round: 1,
  points: lines.reduce((sum, l) => sum + l.earned, 0),
  ledger: lines,
  createdAt: null,
});

const X = () =>
  film(100, 'X', [line('afi', 5), line('oscars', 10, true), line('oscars', 10)]);
const Y = () => film(200, 'Y', [line('afi', 5, true), line('oscars', 10)]);

const seat = (draftId: number, name: string, picks: ReturnType<typeof film>[]): Seat => ({
  draftId,
  userId: draftId === 12 ? null : draftId + 1000,
  uuid: null,
  name,
  isDummy: draftId === 12,
  order: draftId,
  picks,
  total: picks.reduce((sum, pick) => sum + pick.points, 0),
});

const SEATS = [seat(10, 'A', [X()]), seat(11, 'B', [Y()]), seat(12, 'C', [X()])];

describe('buildSeasonLedger', () => {
  const ledger = buildSeasonLedger(SEATS, MOMENTS, 1010);

  it('adds up: Σ deltas and Σ by show both equal the board total, for every seat', () => {
    expect(SEATS.map((s) => s.total)).toEqual([35, 20, 35]);
    for (const s of SEATS) {
      const deltas = ledger.steps.reduce(
        (sum, step) => sum + (step.delta.get(s.draftId) ?? 0),
        0,
      );
      const season = ledger.seats.find((entry) => entry.draftId === s.draftId);
      const shows = [...(season?.byShow.values() ?? [])].reduce(
        (sum, v) => sum + v.nom + v.win,
        0,
      );
      expect(deltas).toBe(s.total);
      expect(shows).toBe(s.total);
      expect(season?.total).toBe(s.total);
    }
  });

  it('splits a show into nominations and wins, counting a win once more', () => {
    const a = ledger.seats.find((s) => s.draftId === 10);
    expect(a?.byShow.get('oscars')).toEqual({ nom: 20, win: 10 });
    expect(a?.byMoment.get('1-ceremony')).toBe(10);
  });

  it('counts a stray win on a show with no ceremony on its nominations step', () => {
    expect(ledger.steps[0]?.moment.key).toBe('2-nominations');
    expect(ledger.steps[0]?.delta.get(11)).toBe(10);
  });

  it('makes no step for an upcoming moment', () => {
    expect(ledger.steps.map((s) => s.moment.key)).toEqual([
      '2-nominations',
      '1-nominations',
      '1-ceremony',
    ]);
    expect(ledger.latest?.moment.key).toBe('1-ceremony');
  });

  it('ranks with rankSeats: a tie stays in draft order and shares a position', () => {
    const after = ledger.steps[1]?.standings.map((row) => [
      row.name,
      row.total,
      row.position,
    ]);
    expect(after).toEqual([
      ['A', 25, 1],
      ['C', 25, 1],
      ['B', 20, 3],
    ]);
    expect(ledger.steps[1]?.standings[0]?.isViewer).toBe(true);
  });

  it('reads moves as places gained: passing seats go up, the passed seat down', () => {
    // After the AFI: B 10 (1st), A 5 and C 5 (2nd). After Oscar nominations:
    // A and C 25 (1st), B 20 (3rd).
    const moves = ledger.steps[1]?.moves;
    expect([moves?.get(10), moves?.get(12), moves?.get(11)]).toEqual([1, 1, -2]);
    expect([...(ledger.steps[0]?.moves.values() ?? [])]).toEqual([0, 0, 0]);
  });

  it('lists only the winning lines at a ceremony, and counts the seats holding each film', () => {
    expect(ledger.steps[2]?.films).toEqual([
      { title: 'X', posterUrl: null, points: 10, won: 1, holders: 2 },
    ]);
    expect(ledger.steps[1]?.films.map((f) => [f.title, f.points, f.won])).toEqual([
      ['X', 20, 0],
      ['Y', 10, 0],
    ]);
  });

  it('prefers a live step for latest', () => {
    const live = MOMENTS.map((m) =>
      m.key === '1-nominations' ? { ...m, state: 'live' as const } : m,
    );
    expect(buildSeasonLedger(SEATS, live, null).latest?.moment.key).toBe('1-nominations');
  });
});
