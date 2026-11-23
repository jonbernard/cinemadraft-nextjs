import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LeagueTabs } from './LeagueTabs';

describe('LeagueTabs', () => {
  it('marks the current view and carries a past season across', () => {
    render(<LeagueTabs leagueId={7} year={2025} activeYear={2026} current="standings" />);
    const nav = screen.getByRole('navigation', { name: 'League views' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Standings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Board' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('link', { name: 'Board' })).toHaveAttribute(
      'href',
      '/leagues/7/2025',
    );
    expect(screen.getByRole('link', { name: 'Standings' })).toHaveAttribute(
      'href',
      '/leagues/7/2025/standings',
    );
    expect(screen.getByRole('link', { name: 'Race' })).toHaveAttribute(
      'href',
      '/leagues/7/2025/race',
    );
  });
});
