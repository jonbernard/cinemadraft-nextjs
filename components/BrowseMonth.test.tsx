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
    // The unoptimized path serves the URL byte-for-byte; an optimized one
    // would still contain "image.tmdb.org" as a substring of the encoded
    // query string, so equality is the only assertion that can fail.
    expect(poster).toHaveAttribute('src', month.films[0]?.posterUrl);
  });

  it('links the title to the film page', () => {
    render(<BrowseMonth month={month} isSignedIn={false} />);
    expect(screen.getByRole('link', { name: 'The Matrix' })).toHaveAttribute(
      'href',
      '/films/603',
    );
  });

  it('🔴 the poster wrapper is not a second, nameless stop', () => {
    // Two links per film point at the same page and only one of them says
    // where it goes. Measured on /browse: 17 of 54 links announced nothing.
    render(<BrowseMonth month={month} isSignedIn={false} />);

    const named = screen.getAllByRole('link');
    expect(named).toHaveLength(1);
    expect(named[0]).toHaveAccessibleName('The Matrix');
  });

  it('the poster is still reachable by mouse and still shows the image', () => {
    // Hidden from assistive tech and from Tab, not from the page: the poster
    // is the obvious thing to press with a thumb.
    const { container } = render(<BrowseMonth month={month} isSignedIn={false} />);
    const poster = container.querySelector('a[aria-hidden="true"]');

    expect(poster).toHaveAttribute('href', '/films/603');
    // aria-hidden on a focusable element is itself a violation; the two
    // attributes only make sense together.
    expect(poster).toHaveAttribute('tabindex', '-1');
    expect(poster?.querySelector('img')).not.toBeNull();
  });
});
