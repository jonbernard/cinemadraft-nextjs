import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveBoard } from './LiveBoard';

/**
 * 🔴 Every number here is distinct on purpose.
 *
 * The plan's draft fixture gave the seat and its only film the same total, so
 * `getByText('14')` would have matched two elements and thrown — and had it
 * matched one, it could not have said *which* number it found. Distinct values
 * mean each assertion below names exactly one thing.
 *
 * The seat order is also deliberately neither alphabetical nor reverse
 * alphabetical (`Zoe, Ada, Bo`): the service sorts, and this component must
 * render what it was handed. A component that re-sorted by name would pass
 * against an alphabetical fixture and fail against this one.
 */
const league = {
  id: 1,
  name: 'The Main League',
  total: 19,
  seats: [
    {
      draftId: 10,
      name: 'Zoe',
      isViewer: true,
      earned: 14,
      films: [
        {
          movieId: 1,
          title: 'Sinners',
          posterUrl: null,
          earned: 10,
          status: 'won' as const,
        },
        {
          movieId: 2,
          title: 'Marty Supreme',
          posterUrl: null,
          earned: 4,
          status: 'nominated' as const,
        },
      ],
    },
    {
      draftId: 11,
      name: 'Ada',
      isViewer: false,
      earned: 5,
      films: [
        {
          movieId: 3,
          title: 'Anora',
          posterUrl: null,
          earned: 3,
          status: 'nominated' as const,
        },
        {
          movieId: 4,
          title: 'Nickel Boys',
          posterUrl: null,
          earned: 2,
          status: 'nominated' as const,
        },
      ],
    },
    { draftId: 12, name: 'Bo', isViewer: false, earned: 0, films: [] },
  ],
};

describe('LiveBoard', () => {
  it('renders the seats in the order the service ranked them', () => {
    render(<LiveBoard leagues={[league]} />);
    const seats = screen.getAllByRole('heading', { level: 4 });
    expect(seats.map((seat) => seat.textContent)).toEqual(['Zoe', 'Ada', 'Bo']);
  });

  it('🔴 shows the points earned at THIS show, not the season total', () => {
    // The whole point of the page. A seat's season total is on the dashboard;
    // what it took tonight is the thing nobody can otherwise see. Each of these
    // is one element: 19 the league's take, 14 and 5 the seats', 10/4/3/2 the
    // films'.
    render(<LiveBoard leagues={[league]} />);
    for (const value of ['19', '14', '5', '10', '4', '3', '2']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it('marks the reader’s own seat, and only that one', () => {
    render(<LiveBoard leagues={[league]} />);
    // Not by colour alone (§6.4): the word is in the markup.
    expect(screen.getAllByText(/your seat/i)).toHaveLength(1);
  });

  it('says so when a seat holds nothing in play here', () => {
    // A real and common state — twelve shows, and most seats are not in most of
    // them. An empty strip with no words reads as a failed load.
    render(<LiveBoard leagues={[league]} />);
    expect(screen.getByText(/nothing in play/i)).toBeInTheDocument();
  });

  it('🔴 stamps the seal on a film that has won here', () => {
    // `status` is what T15 wired into PosterFrame, and passing it through is
    // the only reason a win is visible on this page at all. Exactly one of the
    // four films won.
    render(<LiveBoard leagues={[league]} />);
    expect(screen.getAllByRole('img', { name: 'Winner' })).toHaveLength(1);
  });
});
