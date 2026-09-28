import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeasonUpNext } from './SeasonUpNext';
import { DAY_BEFORE_OSCARS, season2026 } from './season-fixtures';

describe('SeasonUpNext', () => {
  it('counts down in words and caps the films with "and N more"', () => {
    const view = season2026(DAY_BEFORE_OSCARS);
    render(<SeasonUpNext view={view} now={DAY_BEFORE_OSCARS} />);
    expect(screen.getByText('Up next · tomorrow')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Academy of Motion Picture Arts and Sciences',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByRole('link', { name: 'Sinners' })).toHaveAttribute(
      'href',
      '/films/sinners-1233413',
    );
    expect(screen.getByRole('link', { name: 'and 2 more' })).toHaveAttribute(
      'href',
      '/award-shows/oscars?year=2026',
    );
  });

  it('before nominations are out, names no films and says when they are due', () => {
    const view = season2026(Date.UTC(2026, 0, 20));
    render(<SeasonUpNext view={view} now={Date.UTC(2026, 0, 20)} />);
    expect(view.next?.key).toBe('10-nominations');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText('Nominations are announced Wed Jan 21.')).toBeInTheDocument();
  });

  it('with nothing left: the season is complete, and the next one comes in the autumn', () => {
    const view = season2026();
    render(<SeasonUpNext view={view} now={Date.UTC(2026, 8, 27)} />);
    expect(
      screen.getByRole('heading', { name: 'The 2026 season is complete' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Dates for the 2027 season come in the autumn.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/The last word:/)).toHaveTextContent(
      'The last word: One Battle After Another, 6 wins at the Academy of Motion Picture Arts and Sciences.',
    );
  });

  it('off-season names the active year it is waiting for', () => {
    const view = { ...season2026(), activeYear: 2027, offSeason: true };
    render(<SeasonUpNext view={view} now={Date.UTC(2026, 9, 1)} />);
    expect(
      screen.getByText('Dates for the 2027 season come in the autumn.'),
    ).toBeInTheDocument();
  });
});
