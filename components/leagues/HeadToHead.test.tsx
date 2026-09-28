import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeadToHead } from './HeadToHead';
import { CROSS_GROUP, LEADER, SAME_GROUP } from './head-to-head-fixtures';

/** The three printed segment totals, a-only, both, b-only. */
function segments(): number[] {
  const list = screen.getByRole('list', { name: 'Where the points come from' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => Number(item.querySelector('[data-points]')?.textContent));
}

describe('HeadToHead', () => {
  it('reads from the reader’s side, and its segments add up to both totals', () => {
    render(<HeadToHead h2h={CROSS_GROUP} closeHref="/leagues/1" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'You’re 25 behind Micah Baird',
    );
    const [onlyA = 0, both = 0, onlyB = 0] = segments();
    expect(both).toBe(415);
    expect(onlyA + both).toBe(810);
    expect(onlyB + both).toBe(835);
    expect(
      screen.getByText(
        '415 of your 810 points are films Micah also holds. The gap is the other five picks each.',
      ),
    ).toBeInTheDocument();
    // Two of each side's unique films, by points.
    const gap = screen.getByRole('list', { name: 'Films that make the gap' });
    expect(within(gap).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('list', { name: 'Both' })).toHaveTextContent('Sinners');
  });

  it('says so for a same-group pair rather than drawing an empty band', () => {
    render(<HeadToHead h2h={SAME_GROUP} closeHref="/leagues/1" />);
    expect(screen.queryByRole('list', { name: 'Both' })).toBeNull();
    expect(
      screen.getAllByText(/Same group, so no film is on both teams/).length,
    ).toBeGreaterThan(0);
    expect(segments()[1]).toBe(0);
  });

  it('names both seats for a follower, positions included', () => {
    render(<HeadToHead h2h={LEADER} closeHref="/leagues/1" />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Micah Baird leads James Kinney by 25',
    );
    expect(screen.getByText('Head to head · 1st against 2nd')).toBeInTheDocument();
  });
});
