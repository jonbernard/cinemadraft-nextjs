import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LeaderboardTable } from './LeaderboardTable';

function leaderboardOf(count: number) {
  return {
    year: 2026,
    events: [{ abbreviation: 'oscars', name: 'Academy Awards' }],
    rows: Array.from({ length: count }, (_, index) => ({
      movieId: index + 1,
      title: `Film ${index + 1}`,
      events: { oscars: count - index },
      total: count - index,
    })),
  };
}

describe('LeaderboardTable', () => {
  it('renders ten rows and hides the rest behind a reveal', () => {
    render(<LeaderboardTable leaderboard={leaderboardOf(25)} />);

    expect(screen.getAllByRole('row')).toHaveLength(11); // ten films + the header
    expect(screen.queryByText('Film 11')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show 10 more/i })).toBeInTheDocument();
  });

  it('reveals ten more per press and drops the button at the end', async () => {
    const user = userEvent.setup();
    render(<LeaderboardTable leaderboard={leaderboardOf(25)} />);

    await user.click(screen.getByRole('button', { name: /show 10 more/i }));
    expect(screen.getByText('Film 20')).toBeInTheDocument();
    expect(screen.queryByText('Film 21')).not.toBeInTheDocument();

    // Five left, so the label says five rather than lying about ten.
    await user.click(screen.getByRole('button', { name: /show 5 more/i }));
    expect(screen.getByText('Film 25')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });

  it('renders no reveal at all when the season fits', () => {
    render(<LeaderboardTable leaderboard={leaderboardOf(7)} />);

    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });

  it('never scrolls horizontally — no min-width on the table', () => {
    const { container } = render(<LeaderboardTable leaderboard={leaderboardOf(3)} />);
    const table = container.querySelector('table');

    expect(table?.className).not.toMatch(/min-w-/);
    expect(container.querySelector('.overflow-x-auto')).toBeNull();
  });
});
