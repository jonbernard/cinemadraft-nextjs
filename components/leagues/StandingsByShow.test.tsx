import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { StandingsSeatRow } from '@/lib/services/season-ledger';
import { StandingsByShow } from './StandingsByShow';

const SHOWS = [
  { abbreviation: 'gg', name: 'Golden Globes' },
  { abbreviation: 'oscars', name: 'Academy Awards' },
];

const row = (overrides: Partial<StandingsSeatRow>): StandingsSeatRow => ({
  draftId: 1,
  name: 'Ada',
  uuid: null,
  isViewer: false,
  position: 1,
  byShow: { gg: 40, oscars: 60 },
  last: 60,
  move: 0,
  total: 100,
  ...overrides,
});

describe('StandingsByShow', () => {
  it('renders the total it is given, never a re-sum of the cells', () => {
    // Cells sum to 100 and the total says 105. Real data never produces this
    // (buildSeasonLedger's invariant, tested there), which is the point: it
    // tells a re-sum from a pass-through.
    render(<StandingsByShow rows={[row({ total: 105 })]} shows={SHOWS} />);
    const table = screen.getByRole('table', {
      name: /standings with points by award show/i,
    });
    const cells = within(table).getAllByRole('cell');
    expect(cells.at(-1)).toHaveTextContent('105');
    expect(within(table).queryByText('100')).toBeNull();
  });

  it('prints each show as nominations plus wins, in the order given', () => {
    render(<StandingsByShow rows={[row({})]} shows={SHOWS} />);
    const table = screen.getByRole('table');
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((th) => th.textContent);
    expect(headers).toEqual(['Pos', 'Member', 'GG', 'OSCARS', 'Last', 'Move', 'Total']);
    const cells = within(table)
      .getAllByRole('cell')
      .map((td) => td.textContent);
    expect(cells.slice(1, 3)).toEqual(['40', '60']);
  });

  it('announces moves in words', () => {
    render(
      <StandingsByShow
        rows={[
          row({ move: 2 }),
          row({ draftId: 2, name: 'Grace', position: 2, move: -1 }),
        ]}
        shows={SHOWS}
      />,
    );
    const table = screen.getByRole('table');
    expect(within(table).getByText('up 2 places')).toBeInTheDocument();
    expect(within(table).getByText('down 1 place')).toBeInTheDocument();
  });

  it('marks a shared position and the reader’s own row', () => {
    render(
      <StandingsByShow
        rows={[row({ isViewer: true }), row({ draftId: 2, name: 'Grace', position: 1 })]}
        shows={SHOWS}
      />,
    );
    const table = screen.getByRole('table');
    const [first] = within(table).getAllByRole('row').slice(1);
    expect(first).toHaveAttribute('aria-current', 'true');
    expect(within(table).getAllByText('(tied)')).toHaveLength(2);
  });
});
