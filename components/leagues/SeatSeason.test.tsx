import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Movie } from '@/lib/repositories/movies';
import type { Seat } from '@/lib/services/draft';
import type { Moment } from '@/lib/services/moments';
import type { LedgerLine } from '@/lib/services/scoring';
import { toSeatSeasonView } from '@/lib/services/season-ledger';
import { SeatSeason } from './SeatSeason';

/**
 * A seat's page (P16.T21), rendered from `toSeatSeasonView` over
 * `buildSeasonLedger`'s own output rather than a hand-made fixture (T19's
 * lesson): the footer is only worth checking against the real arithmetic.
 */
const moment = (
  eventId: number,
  abbreviation: string,
  phase: Moment['phase'],
): Moment => ({
  key: `${eventId}-${phase}`,
  eventId,
  abbreviation,
  name: abbreviation === 'oscars' ? 'Academy Awards' : 'Golden Globes',
  phase,
  date: null,
  order: eventId * 10 + (phase === 'ceremony' ? 1 : 0),
  state: 'finished',
  nominations: 1,
  winners: 1,
});

let nominationId = 0;
const line = (show: string, points: number, won = false): LedgerLine => ({
  nominationId: ++nominationId,
  awardId: nominationId,
  awardName: `Award ${nominationId}`,
  eventAbbreviation: show,
  eventName: show,
  points,
  won,
  earned: won ? points * 2 : points,
});

const pick = (id: number, title: string, lines: LedgerLine[]) => ({
  pickId: id,
  movie: { id, title, poster: null, tmdbId: String(id) } as unknown as Movie,
  round: id,
  points: lines.reduce((sum, l) => sum + l.earned, 0),
  ledger: lines,
  createdAt: null,
});

const seat = (draftId: number, name: string, picks: ReturnType<typeof pick>[]): Seat => ({
  draftId,
  userId: draftId + 1000,
  uuid: null,
  name,
  isDummy: false,
  order: draftId,
  picks,
  total: picks.reduce((sum, p) => sum + p.points, 0),
});

const BOARD = {
  leagueId: 7,
  leagueName: 'L',
  year: 2026,
  groups: [
    {
      group: 1,
      rounds: 2,
      seats: [
        seat(1, 'Ada', [
          pick(1, 'Alpha', [
            line('gg', 5, true),
            line('oscars', 10, true),
            line('oscars', 10),
          ]),
          pick(2, 'Bravo', [line('gg', 5)]),
        ]),
        seat(2, 'Grace', [pick(3, 'Charlie', [line('oscars', 10)])]),
      ],
    },
  ],
};
const MOMENTS = [
  moment(1, 'gg', 'nominations'),
  moment(1, 'gg', 'ceremony'),
  moment(2, 'oscars', 'nominations'),
  moment(2, 'oscars', 'ceremony'),
];

describe('SeatSeason', () => {
  const view = toSeatSeasonView(BOARD, MOMENTS, 1, null);
  if (!view) throw new Error('seat 1 is on the board');

  it('adds its footer up to the seat total', () => {
    const { container } = render(<SeatSeason view={view} />);
    const byShow = [...container.querySelectorAll('[data-show-total]')].map((td) =>
      Number(td.textContent),
    );
    const total = Number(container.querySelector('[data-season-total]')?.textContent);
    expect(byShow).toEqual([15, 30]);
    expect(total).toBe(45);
    expect(byShow.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('puts picks down the side in draft order and shows across in moment order', () => {
    render(<SeatSeason view={view} />);
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Pick', 'GG', 'OSCARS', 'Total']);
    const rows = within(table).getAllByRole('row').slice(1, -1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      '01Alpha',
      '02Bravo',
    ]);
    // Alpha at the Oscars: 20 on its winning line and 10 on the other; won once.
    expect(within(rows[0] as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent(
      '30won',
    );
  });

  it('offers every seat of the season in a GET form, this one chosen', () => {
    const { container } = render(<SeatSeason view={view} />);
    const form = container.querySelector('form');
    expect(form?.getAttribute('method')).toBe('get');
    expect(form?.getAttribute('action')).toBe('/leagues/7/seats/1');
    const select = screen.getByRole('combobox', { name: 'Seat' }) as HTMLSelectElement;
    expect(select.name).toBe('seat');
    expect(select.value).toBe('1');
    expect([...select.options].map((o) => o.textContent)).toEqual(['Ada', 'Grace']);
  });

  it('is null for a draft that holds no seat on the board', () => {
    expect(toSeatSeasonView(BOARD, MOMENTS, 99, null)).toBeNull();
  });
});
