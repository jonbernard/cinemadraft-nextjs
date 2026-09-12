import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadBrowsePage = vi.hoisted(() => vi.fn());
vi.mock('@/actions/browse/load-page', () => ({ loadBrowsePage }));

import type { BrowseMonth as BrowseMonthData } from '@/lib/services/browse';
import { BrowseList } from './BrowseList';

/**
 * 🔴 jsdom has no `IntersectionObserver` at all, so the sentinel can only be
 * exercised by supplying one. This stub records the callbacks of observers that
 * are actually observing something, and `intersect()` fires them — which is the
 * event the component is written against, not a scroll it could never receive
 * in a document with no layout.
 *
 * `disconnect` really does drop the callback: "stops at the last page" is only
 * a true assertion if an unobserved sentinel cannot fire.
 */
const callbacks = new Set<IntersectionObserverCallback>();

function intersect(): void {
  for (const callback of callbacks) {
    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  }
}

class StubObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe() {
    callbacks.add(this.callback);
  }
  unobserve() {
    callbacks.delete(this.callback);
  }
  disconnect() {
    callbacks.delete(this.callback);
  }
}

function monthOf(label: string, title: string): BrowseMonthData {
  return {
    label,
    films: [
      {
        tmdbId: `${label}-${title}`,
        title,
        posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg',
        releaseDate: new Date('2026-10-01'),
        watched: false,
      },
    ],
  };
}

describe('BrowseList', () => {
  beforeEach(() => {
    callbacks.clear();
    loadBrowsePage.mockReset();
    vi.stubGlobal('IntersectionObserver', StubObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends the next page when the sentinel is seen', async () => {
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: {
        when: 'past',
        page: 2,
        pageCount: 3,
        months: [monthOf('09/2026', 'Second')],
      },
    });
    render(
      <BrowseList
        when="past"
        initial={{
          when: 'past',
          page: 1,
          pageCount: 3,
          months: [monthOf('10/2026', 'First')],
          hero: null,
        }}
        isSignedIn={false}
      />,
    );

    intersect();

    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(loadBrowsePage).toHaveBeenCalledWith({ when: 'past', page: 2 });
  });

  it('never asks twice for the same page', async () => {
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: { when: 'past', page: 2, pageCount: 3, months: [], hero: null },
    });
    render(
      <BrowseList
        when="past"
        initial={{ when: 'past', page: 1, pageCount: 3, months: [], hero: null }}
        isSignedIn={false}
      />,
    );

    intersect();
    intersect();

    await waitFor(() => expect(loadBrowsePage).toHaveBeenCalledTimes(1));
  });

  it('🔴 folds a repeated month into the one already shown', async () => {
    // Two pages routinely carry films from the same month. Pushing a second
    // "October 2026" section is the visible bug this shape invites.
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: {
        when: 'past',
        page: 2,
        pageCount: 3,
        months: [monthOf('10/2026', 'Second')],
      },
    });
    render(
      <BrowseList
        when="past"
        initial={{
          when: 'past',
          page: 1,
          pageCount: 3,
          months: [monthOf('10/2026', 'First')],
          hero: null,
        }}
        isSignedIn={false}
      />,
    );

    intersect();

    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());
    expect(screen.getAllByRole('heading', { name: 'October 2026' })).toHaveLength(1);
    // Folded, not replaced: the film already on the shelf is still there, and
    // the month now says it holds two.
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('2 films')).toBeInTheDocument();
  });

  it('stops at the last page', async () => {
    render(
      <BrowseList
        when="past"
        initial={{ when: 'past', page: 3, pageCount: 3, months: [], hero: null }}
        isSignedIn={false}
      />,
    );

    intersect();

    expect(loadBrowsePage).not.toHaveBeenCalled();
    expect(screen.queryByTestId('browse-sentinel')).toBeNull();
  });

  it('stops observing once the last page has arrived', async () => {
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: {
        when: 'past',
        page: 2,
        pageCount: 2,
        months: [monthOf('09/2026', 'Last')],
        hero: null,
      },
    });
    render(
      <BrowseList
        when="past"
        initial={{ when: 'past', page: 1, pageCount: 2, months: [], hero: null }}
        isSignedIn={false}
      />,
    );

    intersect();
    await waitFor(() => expect(screen.getByText('Last')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('browse-sentinel')).toBeNull());

    // Every scroll to the bottom of a finished list would otherwise fire a
    // request that returns nothing.
    intersect();
    expect(loadBrowsePage).toHaveBeenCalledTimes(1);
  });

  it('🔴 stops when a page comes back with no films, whatever the page count says', async () => {
    // The future side reports 71 pages and holds films for about three of them
    // (P15.T9). Trusting the count alone would fire a request on every scroll
    // for the other sixty-eight.
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: { when: 'future', page: 2, pageCount: 71, months: [], hero: null },
    });
    render(
      <BrowseList
        when="future"
        initial={{ when: 'future', page: 1, pageCount: 71, months: [], hero: null }}
        isSignedIn={false}
      />,
    );

    intersect();
    await waitFor(() => expect(screen.queryByTestId('browse-sentinel')).toBeNull());

    intersect();
    expect(loadBrowsePage).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when a page fails, rather than silently ending the list', async () => {
    loadBrowsePage.mockResolvedValue({
      ok: false,
      code: 'INVALID',
      message: 'the catalogue could not be reached',
    });
    render(
      <BrowseList
        when="past"
        initial={{ when: 'past', page: 1, pageCount: 3, months: [], hero: null }}
        isSignedIn={false}
      />,
    );

    intersect();

    const retry = await screen.findByRole('button', { name: /try again/i });
    expect(screen.getByText(/could not be reached/)).toBeInTheDocument();

    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: {
        when: 'past',
        page: 2,
        pageCount: 3,
        months: [monthOf('09/2026', 'Second')],
      },
    });
    await userEvent.click(retry);

    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument());
  });

  it('announces that the page grew', async () => {
    loadBrowsePage.mockResolvedValue({
      ok: true,
      data: {
        when: 'past',
        page: 2,
        pageCount: 3,
        months: [monthOf('09/2026', 'Second')],
      },
    });
    render(
      <BrowseList
        when="past"
        initial={{ when: 'past', page: 1, pageCount: 3, months: [], hero: null }}
        isSignedIn={false}
      />,
    );

    intersect();

    // The single biggest a11y cost of infinite scroll is a page that grows
    // under a reader who is never told.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/1 more film/),
    );
  });
});
