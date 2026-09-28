import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DAY_BEFORE_OSCARS, season2026 } from '@/components/awards/season-fixtures';

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ getCurrentUser }));

const getSeasonView = vi.hoisted(() => vi.fn());
const getSeasonViewer = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/season-view', () => ({ getSeasonView, getSeasonViewer }));

const getSeasons = vi.hoisted(() => vi.fn(async () => [2026, 2025]));
vi.mock('@/lib/services/season', () => ({ getSeasons }));

const getAwardShows = vi.hoisted(() => vi.fn(async () => []));
vi.mock('@/lib/services/award-show', () => ({ getAwardShows }));

vi.mock('next/headers', () => ({
  headers: async () => new Map([['host', 'localhost:3000']]),
}));

import AwardShowsPage from './page';

const props = (year?: string) => ({ searchParams: Promise.resolve({ year }) });

/**
 * `/award-shows` (P16.T15–T16). 🔴 The per-league lines cost a board load per
 * league, and a stranger has no leagues: the page must never ask for them
 * without a user. Counted here as calls, since the service is the only path
 * to those queries.
 */
describe('the award shows page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSeasonView.mockResolvedValue(season2026(DAY_BEFORE_OSCARS));
    getSeasonViewer.mockResolvedValue({
      leagues: [
        {
          leagueId: 1,
          name: 'Racso award',
          byMoment: new Map([['8-nominations', { points: 170, position: 16, move: -3 }]]),
        },
      ],
      atStake: {
        films: [{ title: 'Frankenstein', tmdbId: '1062722', category: 'Best Picture' }],
        points: 20,
        more: 0,
      },
    });
  });

  it('signed out: 0 viewer loads, and no league on the page', async () => {
    getCurrentUser.mockResolvedValue(null);
    render(await AwardShowsPage(props()));
    expect(getSeasonViewer).toHaveBeenCalledTimes(0);
    expect(screen.queryByText('Racso award')).not.toBeInTheDocument();
    expect(getSeasonView).toHaveBeenCalledWith(null);
  });

  it('signed in: each finished moment says what it did, in words too', async () => {
    getCurrentUser.mockResolvedValue({ id: 3, role: 'member' });
    render(await AwardShowsPage(props('2026')));
    expect(getSeasonView).toHaveBeenCalledWith(2026);
    expect(getSeasonViewer).toHaveBeenCalledWith(3, 2026);
    const oscars = screen
      .getAllByRole('link', { name: /Academy of Motion Picture Arts and Sciences/ })
      .find((link) => link.textContent?.includes('125 nominations'));
    expect(oscars).toHaveTextContent('Racso award +170 · 16th ▼3, down 3 places');
    expect(
      screen.getByText('1 of your nominations is up for 20 more points'),
    ).toBeInTheDocument();
  });
});
