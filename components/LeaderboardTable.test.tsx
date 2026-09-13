import { render, screen, within } from '@testing-library/react';
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
    // 🔴 By the title's disclosure, not by `getByText`. Since P17.T4 the title
    // is in the markup twice — a disclosure below `lg`, plain text at `lg` and
    // up — with exactly one of them `display:none` at any real width. jsdom has
    // no CSS, so both match; the disclosure is the one that proves the row
    // rendered.
    expect(screen.getByRole('button', { name: /^Film 20/ })).toBeInTheDocument();
    expect(screen.queryByText('Film 21')).not.toBeInTheDocument();

    // Five left, so the label says five rather than lying about ten.
    await user.click(screen.getByRole('button', { name: /show 5 more/i }));
    expect(screen.getByRole('button', { name: /^Film 25/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });

  it('renders no reveal at all when the season fits', () => {
    render(<LeaderboardTable leaderboard={leaderboardOf(7)} />);

    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.queryByRole('button', { name: /show/i })).not.toBeInTheDocument();
  });

  it('names every column in a legend, not in a tooltip', () => {
    render(
      <LeaderboardTable
        leaderboard={{
          year: 2026,
          events: [
            { abbreviation: 'oscars', name: 'Academy Awards' },
            { abbreviation: 'gg', name: 'Golden Globes' },
          ],
          rows: [{ movieId: 1, title: 'Sinners', events: { oscars: 20 }, total: 20 }],
        }}
      />,
    );

    // `title` never fires on a touch screen, which is most readers. The names
    // have to be on the page.
    expect(screen.getByText('Academy Awards')).toBeInTheDocument();
    expect(screen.getByText('Golden Globes')).toBeInTheDocument();
    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).not.toHaveAttribute('title');
    }
  });

  it('breaks a total into its shows, for the reader who cannot see the columns', async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardTable
        leaderboard={{
          year: 2026,
          events: [
            { abbreviation: 'oscars', name: 'Academy Awards' },
            { abbreviation: 'gg', name: 'Golden Globes' },
          ],
          rows: [
            { movieId: 1, title: 'Sinners', events: { oscars: 20, gg: 15 }, total: 35 },
          ],
        }}
      />,
    );

    const toggle = screen.getByRole('button', { name: /Sinners/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // The breakdown names the show, not the abbreviation: the reader opening
    // this is the one who cannot see the legend either.
    const breakdown = screen.getByTestId('breakdown-1');
    expect(within(breakdown).getByText('Academy Awards')).toBeInTheDocument();
    expect(within(breakdown).getByText('20')).toBeInTheDocument();
    expect(within(breakdown).getByText('Golden Globes')).toBeInTheDocument();
    expect(within(breakdown).getByText('15')).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByTestId('breakdown-1')).toBeNull();
  });

  it('lists only the shows a film actually scored at', async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardTable
        leaderboard={{
          year: 2026,
          events: [
            { abbreviation: 'oscars', name: 'Academy Awards' },
            { abbreviation: 'razzies', name: 'Razzies' },
          ],
          rows: [{ movieId: 1, title: 'Sinners', events: { oscars: 20 }, total: 20 }],
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Sinners/ }));
    // A row of zeroes is noise; the columns show zeroes because a grid has to
    // be rectangular and a list does not.
    expect(within(screen.getByTestId('breakdown-1')).queryByText('Razzies')).toBeNull();
  });

  it('never scrolls horizontally below `lg` (D79), and does scroll above it', () => {
    const { container } = render(<LeaderboardTable leaderboard={leaderboardOf(3)} />);
    const table = container.querySelector('table');

    // D79 is unchanged: on a phone the reader gets Film and Total with no
    // sideways scroll, because the scroll put Total off screen at every width.
    expect(table?.className).not.toMatch(/(^|\s)min-w-/);
    expect(container.querySelector('.overflow-x-auto')).toBeNull();

    // Above `lg` the per-show columns return and the table owns its own
    // overflow, so that it can never hand it to the document — a range D79
    // never spoke about.
    expect(container.querySelector('.lg\\:overflow-x-auto')).not.toBeNull();
    // 🔴 And no `lg:min-w-*` either. Measured in a production build: at 1024px
    // the table is 992px inside a 992px wrapper, so any floor low enough to be
    // honest can never bind and one high enough to bind would manufacture the
    // scroll instead of surviving it.
  });
});
