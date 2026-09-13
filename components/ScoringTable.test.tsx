import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type ScoringGroup, ScoringTable } from './ScoringTable';

const levels: ScoringGroup[] = [
  {
    level: 'Oscars',
    tiers: [
      { tier: 1, points: 20 },
      { tier: 2, points: 15 },
      { tier: 3, points: 10 },
    ],
  },
  {
    level: 'Alphabet',
    tiers: [
      { tier: 1, points: 5 },
      { tier: 2, points: 5 },
      { tier: 3, points: 5 },
    ],
  },
  {
    level: 'Razzies',
    tiers: [
      { tier: 1, points: -20 },
      { tier: 2, points: -15 },
      { tier: 3, points: -10 },
    ],
  },
];

describe('ScoringTable', () => {
  it('gives every level its own group in the order it was handed', () => {
    render(<ScoringTable levels={levels} />);
    const headings = screen.getAllByRole('heading', { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual(['Oscars', 'Alphabet', 'Razzies']);
  });

  it('names what each tier means beside its value, not in a separate legend', () => {
    render(<ScoringTable levels={levels} />);
    const oscars = screen.getByTestId('scoring-group-Oscars');
    expect(within(oscars).getByText('Best Picture')).toBeInTheDocument();
    expect(within(oscars).getByText('20')).toBeInTheDocument();
  });

  it('keeps all three rows on a flat level rather than collapsing them', () => {
    // 🔴 Alphabet is 5/5/5 in the real data. Collapsing equal values would
    // erase the fact that the tier system does not apply to it — one of the
    // four things docs/PLAN.md says must survive the rewrite.
    render(<ScoringTable levels={levels} />);
    const alphabet = screen.getByTestId('scoring-group-Alphabet');
    expect(within(alphabet).getAllByText('5')).toHaveLength(3);
  });

  it('prints a negative value with its sign', () => {
    render(<ScoringTable levels={levels} />);
    const razzies = screen.getByTestId('scoring-group-Razzies');
    expect(within(razzies).getByText('-20')).toBeInTheDocument();
  });

  it('falls back to "Tier N" for a tier the copy has no name for', () => {
    // 🔴 The points table is editable; a fourth tier must appear, not vanish.
    render(<ScoringTable levels={[{ level: 'New', tiers: [{ tier: 4, points: 1 }] }]} />);
    expect(screen.getByText('Tier 4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders nothing rather than an empty shell when there are no levels', () => {
    const { container } = render(<ScoringTable levels={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names a penalty level for the prize it actually hands out', () => {
    // Rendered against the real points table the generic labels printed
    // "Best Picture  −20" under the Razzies — a category nobody is nominated
    // for, reading as a scoring bug rather than as the joke.
    render(
      <ScoringTable
        levels={[
          {
            level: 'Razzies',
            tiers: [
              { tier: 1, points: -20 },
              { tier: 2, points: -15 },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText('Worst Picture')).toBeInTheDocument();
    expect(screen.queryByText('Best Picture')).not.toBeInTheDocument();
  });

  it('keys the penalty labels off the values, not off the level name', () => {
    // A level called "Razzies" that pays positively is not a penalty level,
    // and a second penalty level under any other name still is.
    render(
      <ScoringTable
        levels={[
          { level: 'Razzies', tiers: [{ tier: 1, points: 20 }] },
          { level: 'Some Future Penalty', tiers: [{ tier: 1, points: -5 }] },
        ]}
      />,
    );

    const razzies = screen.getByTestId('scoring-group-Razzies');
    expect(within(razzies).getByText('Best Picture')).toBeInTheDocument();

    const future = screen.getByTestId('scoring-group-Some Future Penalty');
    expect(within(future).getByText('Worst Picture')).toBeInTheDocument();
  });
});
