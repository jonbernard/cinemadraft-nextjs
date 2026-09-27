import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FilmPointsPanel } from '@/components/awards/FilmPointsPanel';
import type { FilmSeasonScoring } from '@/lib/services/film';

/**
 * The film page's points panel. 🔴 D126: a film nominated in two seasons
 * shows each season under its own year, and never a sum of the two.
 */
function season(
  year: number,
  shows: { abbreviation: string; name: string; total: number }[],
): FilmSeasonScoring {
  const lines = shows.map((show, index) => ({
    nominationId: year * 10 + index,
    awardId: index + 1,
    awardName: `Award ${index + 1}`,
    eventAbbreviation: show.abbreviation,
    eventName: show.name,
    points: show.total,
    won: false,
    earned: show.total,
  }));
  const total = shows.reduce((sum, show) => sum + show.total, 0);
  return { year, total, byEvent: shows, ledger: { movieId: 29, total, lines } };
}

// *Elle*: 5 in 2018 (BAFTA), 30 in 2017 (Globes 15, Oscars 15).
const ELLE = [
  season(2018, [{ abbreviation: 'bafta', name: 'BAFTA', total: 5 }]),
  season(2017, [
    { abbreviation: 'gg', name: 'Golden Globes', total: 15 },
    { abbreviation: 'oscars', name: 'Academy Awards', total: 15 },
  ]),
];

describe('FilmPointsPanel', () => {
  it('shows every season’s total under its own year, and no sum', () => {
    render(
      <FilmPointsPanel
        scoring={{ seasons: ELLE, averageDraftPosition: 6.5 }}
        title="Elle"
      />,
    );

    expect(screen.getByText('Total, 2018 season').nextSibling?.textContent).toBe('5');
    expect(screen.getByText('Total, 2017 season').nextSibling?.textContent).toBe('30');
    expect(screen.queryByText('35')).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: '2018 season' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: '2017 season' })).toBeTruthy();
  });

  it('links each show to the season its points belong to', () => {
    render(
      <FilmPointsPanel
        scoring={{ seasons: ELLE, averageDraftPosition: null }}
        title="Elle"
      />,
    );

    expect(
      screen
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'))
        .sort(),
    ).toEqual([
      '/award-shows/bafta?year=2018',
      '/award-shows/gg?year=2017',
      '/award-shows/oscars?year=2017',
    ]);
  });

  it('reads as it always has for a one-season film: no season headings', () => {
    render(
      <FilmPointsPanel
        scoring={{ seasons: [ELLE[1] as FilmSeasonScoring], averageDraftPosition: 1 }}
        title="Elle"
      />,
    );

    expect(screen.getByText('Total, 2017 season')).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });
});
