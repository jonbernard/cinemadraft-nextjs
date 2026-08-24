import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BrowseMonth as BrowseMonthData } from '@/lib/services/browse';
import { BrowseMonth } from './BrowseMonth';

const month: BrowseMonthData = {
  label: '07/2026',
  films: [
    {
      tmdbId: '603',
      title: 'The Matrix',
      posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
      releaseDate: new Date('1999-03-31'),
      watched: false,
    },
  ],
};

describe('BrowseMonth', () => {
  it('renders the month heading', () => {
    render(<BrowseMonth month={month} isSignedIn={false} />);
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('renders the poster as an image, TMDB src unchanged (unoptimized)', () => {
    render(<BrowseMonth month={month} isSignedIn={false} />);
    const poster = document.querySelector('img');
    expect(poster).not.toBeNull();
    expect(poster).toHaveAttribute('src', expect.stringContaining('image.tmdb.org'));
  });

  it('links the title to the film page', () => {
    render(<BrowseMonth month={month} isSignedIn={false} />);
    expect(screen.getByRole('link', { name: 'The Matrix' })).toHaveAttribute(
      'href',
      '/films/603',
    );
  });

  it('links the poster to the film page too', () => {
    render(<BrowseMonth month={month} isSignedIn={false} />);
    const poster = document.querySelector('img');
    expect(poster?.closest('a')).toHaveAttribute('href', '/films/603');
  });
});
