import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { StandingsRow } from '@/lib/services/dashboard';
import { StandingsPanel } from './StandingsPanel';

function row(overrides: Partial<StandingsRow> & { userId: number }): StandingsRow {
  return {
    name: `Member ${overrides.userId}`,
    total: 0,
    position: 1,
    isViewer: false,
    ...overrides,
  };
}

/** The cells of every body row, in column order, as trimmed text. */
function bodyRows() {
  const table = screen.getByRole('table');
  return Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td, th')).map(
      (cell) => cell.textContent?.trim() ?? '',
    ),
  );
}

describe('StandingsPanel', () => {
  it('renders every member with a position and a total', () => {
    render(
      <StandingsPanel
        rows={[
          row({ userId: 1, name: 'Ada Lovelace', total: 370, position: 1 }),
          row({ userId: 2, name: 'Grace Hopper', total: 290, position: 2 }),
          row({ userId: 3, name: 'Alan Turing', total: 40, position: 3 }),
        ]}
      />,
    );

    expect(bodyRows()).toEqual([
      ['1', 'Ada Lovelace', '370'],
      ['2', 'Grace Hopper', '290'],
      ['3', 'Alan Turing', '40'],
    ]);
  });

  it('names the table so a screen reader can tell it from the roster', () => {
    render(<StandingsPanel rows={[row({ userId: 1 })]} />);
    expect(screen.getByRole('table', { name: /standings/i })).toBeInTheDocument();
  });

  it('reads the member as the row header, so the total is attributed', () => {
    render(<StandingsPanel rows={[row({ userId: 1, name: 'Ada Lovelace' })]} />);
    expect(screen.getByRole('rowheader', { name: /Ada Lovelace/ })).toBeInTheDocument();
  });

  it('🔴 shows a shared position on every tied row, and the next distinct total skips', () => {
    // Dense ranking (1, 1, 3). The repeated number is printed rather than
    // blanked: a blank cell reads as data that failed to load, and ties are
    // the common case, not an anomaly.
    render(
      <StandingsPanel
        rows={[
          row({ userId: 1, name: 'Ada', total: 120, position: 1 }),
          row({ userId: 2, name: 'Grace', total: 120, position: 1 }),
          row({ userId: 3, name: 'Alan', total: 40, position: 3 }),
        ]}
      />,
    );

    expect(bodyRows()).toEqual([
      ['=1', 'Ada, tied for position 1', '120'],
      ['=1', 'Grace, tied for position 1', '120'],
      ['3', 'Alan', '40'],
    ]);
  });

  it('does not mark a position as tied when it is held alone', () => {
    render(
      <StandingsPanel
        rows={[
          row({ userId: 1, total: 120, position: 1 }),
          row({ userId: 2, total: 40, position: 2 }),
        ]}
      />,
    );

    for (const cells of bodyRows()) {
      expect(cells[0]).not.toContain('=');
      expect(cells[1]).not.toMatch(/tied/);
    }
  });

  it('🔴 renders an all-zero table sensibly — this is opening day', () => {
    // Nothing has been awarded, so every member is level on zero and shares
    // position 1. Most members will see the table in exactly this state first,
    // so it has to look deliberate: twelve positions, twelve totals, no gaps.
    const rows = Array.from({ length: 12 }, (_, index) =>
      row({ userId: index + 1, total: 0, position: 1 }),
    );
    render(<StandingsPanel rows={rows} />);

    const cells = bodyRows();
    expect(cells).toHaveLength(12);
    for (const [position, , total] of cells) {
      expect(position).toBe('=1');
      expect(total).toBe('0');
    }
  });

  it('marks the viewer’s row, and exactly one of them', () => {
    const { container } = render(
      <StandingsPanel
        rows={[
          row({ userId: 1, name: 'Ada', total: 120, position: 1 }),
          row({ userId: 2, name: 'Grace', total: 40, position: 2, isViewer: true }),
          row({ userId: 3, name: 'Alan', total: 10, position: 3 }),
        ]}
      />,
    );

    // The mark must survive with colour removed, so it is asserted as text and
    // as aria-current — never as a class.
    expect(screen.getAllByText('You')).toHaveLength(1);
    const marked = container.querySelectorAll('tbody tr[aria-current]');
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toContain('Grace');
  });

  it('marks no row when the viewer has no seat this season', () => {
    const { container } = render(
      <StandingsPanel rows={[row({ userId: 1 }), row({ userId: 2 })]} />,
    );
    expect(container.querySelectorAll('tbody tr[aria-current]')).toHaveLength(0);
    expect(screen.queryByText('You')).not.toBeInTheDocument();
  });

  it('renders an empty league without crashing', () => {
    render(<StandingsPanel rows={[]} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/once the league has drafted/i)).toBeInTheDocument();
  });

  it('🔴 renders totals with tabular figures so the column cannot jitter (§6.5)', () => {
    render(
      <StandingsPanel
        rows={[
          row({ userId: 1, total: 1290, position: 1 }),
          row({ userId: 2, total: 40, position: 2 }),
        ]}
      />,
    );

    for (const total of ['1290', '40']) {
      expect(screen.getByText(total)).toHaveClass('tabular');
    }
    // The position column is a column of numbers too, and it shifts when a tie
    // adds or drops the marker.
    expect(screen.getByText('1')).toHaveClass('tabular');
  });

  it('keeps a long name in the table rather than letting it push the total out', () => {
    const name = 'Bartholomew Featherstonehaugh-Wintergreen';
    render(<StandingsPanel rows={[row({ userId: 1, name, total: 370 })]} />);

    expect(screen.getByRole('rowheader', { name })).toHaveClass('break-words');
    expect(screen.getByText('370')).toHaveClass('whitespace-nowrap');
  });
});
