import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination page={1} pageCount={1} basePath="/watchlist" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders every page as a link, so a page can be shared', () => {
    render(<Pagination page={1} pageCount={3} basePath="/watchlist" />);

    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'href',
      '/watchlist?page=2',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('carries the other query parameters across, so a sort survives paging', () => {
    render(
      <Pagination
        page={1}
        pageCount={3}
        basePath="/watchlist"
        params={{ view: 'films', sort: 'release' }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'href',
      '/watchlist?view=films&sort=release&page=2',
    );
  });

  it('announces the current page rather than only colouring it', () => {
    render(<Pagination page={2} pageCount={3} basePath="/watchlist" />);
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('offers previous and next only where there is one', () => {
    const { unmount } = render(
      <Pagination page={1} pageCount={3} basePath="/watchlist" />,
    );
    expect(screen.queryByRole('link', { name: 'Previous page' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute(
      'href',
      '/watchlist?page=2',
    );
    unmount();

    render(<Pagination page={3} pageCount={3} basePath="/watchlist" />);
    expect(screen.getByRole('link', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Next page' })).not.toBeInTheDocument();
  });

  it('keeps both ends reachable from the middle of a long list', () => {
    render(<Pagination page={6} pageCount={11} basePath="/watchlist" />);

    for (const target of [1, 5, 6, 7, 11]) {
      expect(screen.getByRole('link', { name: `Page ${target}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Page 3' })).not.toBeInTheDocument();
  });

  it('labels the navigation, so a screen reader can skip it', () => {
    render(
      <Pagination page={1} pageCount={3} basePath="/watchlist" label="Watched films" />,
    );
    expect(screen.getByRole('navigation', { name: 'Watched films' })).toBeInTheDocument();
  });
});
