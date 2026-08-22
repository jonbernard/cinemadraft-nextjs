import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { NavLink } from '@/lib/nav/links';
import { NavRail } from './NavRail';

describe('NavRail', () => {
  it('renders every ready destination', () => {
    render(<NavRail pathname="/" />);
    expect(screen.getByRole('link', { name: 'Leagues' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse' })).toBeInTheDocument();
  });

  // All three real `yours` links are `ready: false` until Phase 10 ships one,
  // so the grouped heading is exercised here with an injected, ready link
  // rather than the (currently empty) real data.
  it('groups the secondary destinations under a labelled heading', () => {
    const yours: NavLink[] = [
      {
        href: '/watchlist',
        label: 'Watchlist',
        ready: true,
        path: 'M6 3h12v18l-6-4.5L6 21z',
        group: 'yours',
      },
    ];
    render(<NavRail pathname="/" yours={yours} />);
    expect(screen.getByText('Yours')).toBeInTheDocument();
  });

  // 🔴 §6.7. aria-current is one signal; the surface step is the second.
  it('marks the current page for assistive technology', () => {
    render(<NavRail pathname="/leagues/1" />);
    expect(screen.getByRole('link', { name: 'Leagues' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not mark home as current on a nested route', () => {
    render(<NavRail pathname="/leagues/1" />);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
