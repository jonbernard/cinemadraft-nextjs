import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type ExampleRow, WorkedExample } from './WorkedExample';

/**
 * 🔴 Deliberately not the real point values. 7 and 14 are numbers that appear
 * nowhere in the `points` table, so a component that printed a hardcoded "15"
 * or "20" — or a hardcoded "× 2" — would be caught by these assertions rather
 * than accidentally agreeing with them.
 */
const winningLine: ExampleRow = {
  nominationId: 1,
  awardName: 'Best Picture',
  eventName: 'Academy Awards',
  points: 7,
  won: true,
  earned: 14,
};

const losingLine: ExampleRow = {
  nominationId: 2,
  awardName: 'Best Director',
  eventName: 'Golden Globes',
  points: 3,
  won: false,
  earned: 3,
};

const lines: ExampleRow[] = [winningLine, losingLine];

describe('WorkedExample', () => {
  it('prints the total it was given, not a sum of its own', () => {
    // 99 is deliberately NOT 14 + 3. The service's total is authoritative
    // (MovieLedger.total is the sum of lines by construction), and a component
    // that re-added the lines would silently substitute its own opinion.
    render(<WorkedExample title="A Film" posterUrl={null} total={99} lines={lines} />);
    expect(screen.getByTestId('worked-example-total')).toHaveTextContent('99');
  });

  it('derives the win multiplier from the data, never a literal', () => {
    const tripled: ExampleRow[] = [{ ...winningLine, points: 7, earned: 21 }];
    render(<WorkedExample title="A Film" posterUrl={null} total={21} lines={tripled} />);
    // If the rule were ever to change, the page would say what the rule now is.
    expect(screen.getByText(/×\s*3/)).toBeInTheDocument();
    expect(screen.queryByText(/×\s*2/)).not.toBeInTheDocument();
  });

  it('shows no multiplier on a nomination that did not win', () => {
    render(
      <WorkedExample title="A Film" posterUrl={null} total={3} lines={[losingLine]} />,
    );
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('does not divide by zero on a zero-point line', () => {
    const zero: ExampleRow[] = [{ ...winningLine, points: 0, earned: 0, won: true }];
    render(<WorkedExample title="A Film" posterUrl={null} total={0} lines={zero} />);
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it('handles a negative line and a negative total without inventing a sign', () => {
    const razzie: ExampleRow[] = [
      {
        nominationId: 3,
        awardName: 'Worst Picture',
        eventName: 'Razzies',
        points: -7,
        won: true,
        earned: -14,
      },
    ];
    render(<WorkedExample title="A Film" posterUrl={null} total={-14} lines={razzie} />);
    const row = screen.getByRole('row', { name: /Worst Picture/ });
    expect(within(row).getByText('-14')).toBeInTheDocument();
    expect(screen.getByTestId('worked-example-total')).toHaveTextContent('-14');
  });

  it('names the win in words, not only in colour', () => {
    render(<WorkedExample title="A Film" posterUrl={null} total={17} lines={lines} />);
    expect(screen.getByText('Won')).toBeInTheDocument();
  });

  it('names the film in the table caption, for a screen reader', () => {
    render(<WorkedExample title="A Film" posterUrl={null} total={17} lines={lines} />);
    expect(screen.getByRole('table', { name: /How A Film scored/ })).toBeInTheDocument();
  });

  it('renders one row per line, even when two share a category', () => {
    // The case that once lost a row: La La Land held two 2017 Best Original
    // Song nominations, and keying the row on the award dropped one, so the
    // visible lines summed to less than the total beneath them. React 19 no
    // longer drops a duplicate-keyed sibling, so this does NOT fail on a key
    // regression — mutating `key` back to the award name leaves it green. What
    // it does catch is any slice, dedupe or filter between `lines` and the
    // rows, which is the failure a reader would actually see.
    const twice: ExampleRow[] = [
      { ...winningLine, nominationId: 10, awardName: 'Original Song' },
      {
        ...winningLine,
        nominationId: 11,
        awardName: 'Original Song',
        won: false,
        earned: 7,
      },
    ];
    render(<WorkedExample title="A Film" posterUrl={null} total={21} lines={twice} />);
    expect(screen.getAllByRole('row', { name: /Original Song/ })).toHaveLength(2);
  });
});
