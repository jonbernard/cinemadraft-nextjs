import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requirePageUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth', () => ({ requirePageUser }));

const getActiveYear = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/season', () => ({ getActiveYear }));

const loadShowProgress = vi.hoisted(() => vi.fn());
const loadNominatedProgress = vi.hoisted(() => vi.fn());
const loadDraftedProgress = vi.hoisted(() => vi.fn());
const loadWatchedFilms = vi.hoisted(() => vi.fn());
vi.mock('@/lib/services/watchlist', () => ({
  loadShowProgress,
  loadNominatedProgress,
  loadDraftedProgress,
  loadWatchedFilms,
}));

/**
 * The server action, stubbed. 🔴 Stubbed rather than left real for two
 * reasons: the real one reaches `lib/db` and would drag this file into the
 * serial project, and pressing a button here has to be observable as a *call*
 * — the whole point is that the view reaches the action at all.
 */
const setWatched = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true as const, data: { watched: true } })),
);
vi.mock('@/actions/watchlist/set-watched', () => ({ setWatched }));

import WatchlistPage from './page';

/**
 * 🔴 **The three progress views had no way to mark a film watched.**
 *
 * They rendered `SeenChip`, which is read-only *and renders nothing at all when
 * `watched` is false* — so the one row a reader had a reason to act on was the
 * one row with no affordance on it, and marking a nominee seen meant going to
 * /browse to find it. Membership of the watchlist **is** the record of having
 * seen a film (D64), so the chip and the control state the same fact and there
 * was never a reason to show one without the other.
 *
 * 🔴 These assert the **wiring**, not `setWatched`'s internals — that action is
 * already gated, and tested where it lives
 * (`actions/watchlist/watchlist-actions.test.ts`,
 * `lib/repositories/watchlists.scoping.test.ts`). What is unguarded here is a
 * view that renders a badge where a button belongs, so the assertions are: a
 * control on *every* film rather than only the marked ones, and a press that
 * actually reaches the action with that film's id.
 *
 * 🔴 Counting matters. "At least one toggle exists" would pass for a view that
 * offered the control on watched rows and the old dead chip on the rest — which
 * is most of the bug, since an unwatched row is the one a reader wants.
 */

const FILMS = [
  {
    movieId: 1,
    tmdbId: '11',
    title: 'Sinners',
    posterUrl: null,
    releaseDate: null,
    watched: false,
  },
  {
    movieId: 2,
    tmdbId: '22',
    title: 'Nickel Boys',
    posterUrl: null,
    releaseDate: null,
    watched: true,
  },
  {
    movieId: 3,
    tmdbId: '33',
    title: 'Anora',
    posterUrl: null,
    releaseDate: null,
    watched: false,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  requirePageUser.mockResolvedValue({ id: 7 });
  getActiveYear.mockResolvedValue(2026);
  loadWatchedFilms.mockResolvedValue({ films: [], count: 0, page: 1, pageCount: 0 });
  loadShowProgress.mockResolvedValue([
    {
      show: 'Academy Awards',
      awards: [
        {
          award: 'Best Picture',
          nominees: FILMS.map((film, index) => ({ ...film, nominationId: index + 1 })),
        },
      ],
      seenFilms: 1,
      films: 3,
      seenNominations: 1,
      nominations: 3,
    },
  ]);
  loadNominatedProgress.mockResolvedValue({
    films: FILMS.map((film) => ({ ...film, nominations: 4 })),
    seen: 1,
    total: 3,
  });
  loadDraftedProgress.mockResolvedValue([
    { leagueId: 1, league: 'The League', films: FILMS, seen: 1, total: 3 },
  ]);
});

async function renderView(view: string) {
  // A Server Component is an async function returning an element; awaiting it
  // is all "rendering on the server" means here.
  // biome-ignore lint/suspicious/noExplicitAny: the page reads only searchParams
  const element = await WatchlistPage({ searchParams: Promise.resolve({ view }) } as any);
  return render(element);
}

describe.each(['awards', 'nominations', 'drafted'])('?view=%s', (view) => {
  it('offers a control on every film, marked or not', async () => {
    const { container } = await renderView(view);

    expect(container.querySelectorAll('[data-testid^="watched-toggle-"]')).toHaveLength(
      3,
    );
    // 🔴 Two of the three are *unwatched*, and those are the rows `SeenChip`
    // rendered as nothing at all.
    expect(screen.getAllByRole('button', { name: /^Mark as watched: / })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /^Watched: Nickel Boys/ })).toBeTruthy();
  });

  it('starts each control in the state the server read', async () => {
    // Otherwise every row renders unmarked and the first press asks to add a
    // film that is already on the list.
    const { container } = await renderView(view);
    const pressed = (id: string) =>
      container
        .querySelector(`[data-testid="watched-toggle-${id}"]`)
        ?.getAttribute('aria-pressed');

    expect(pressed('22')).toBe('true');
    expect(pressed('11')).toBe('false');
  });

  it('reaches the action when pressed, naming that film', async () => {
    // 🔴 The mutation test for all of this: make the button a no-op — drop the
    // `onClick`, or hand it an `onChange` that is not the action — and this is
    // what goes red. The rest could be satisfied by a button that does nothing.
    const { container } = await renderView(view);

    (
      container.querySelector('[data-testid="watched-toggle-11"]') as HTMLButtonElement
    ).click();

    await waitFor(() =>
      expect(setWatched).toHaveBeenCalledWith({ tmdbId: '11', watched: true }),
    );
  });

  it('unmarks a film that is already watched, rather than adding it twice', async () => {
    const { container } = await renderView(view);

    (
      container.querySelector('[data-testid="watched-toggle-22"]') as HTMLButtonElement
    ).click();

    await waitFor(() =>
      expect(setWatched).toHaveBeenCalledWith({ tmdbId: '22', watched: false }),
    );
  });

  it('says in words what the control does', async () => {
    // The bare glyph is what the owner complained about. These views are dense
    // rows of nominees, so the words ride on the control itself rather than in
    // 526 tooltips — and `getAllByText` sees only what is actually visible,
    // where an assertion on the accessible name would pass for `sr-only` text.
    const { container } = await renderView(view);

    // Scoped to the controls: "Watched" is also the name of the first view tab,
    // so a page-wide `getAllByText` would count that and pass for a page with
    // no labels on its buttons at all.
    const words = [...container.querySelectorAll('[data-testid^="watched-toggle-"]')]
      .map((button) =>
        [...button.querySelectorAll('span')]
          .filter((span) => !span.closest('[aria-hidden="true"]'))
          .map((span) => span.textContent)
          .join(''),
      )
      .sort();

    expect(words).toEqual(['Mark as watched', 'Mark as watched', 'Watched']);
  });
});

describe('the awards view', () => {
  it('lays its shows out in one column at every width', async () => {
    // 🔴 One column, phone to desktop — the owner's call in `7064de9`, which
    // replaced the two columns from `lg` this test used to pin.
    //
    // `lg:items-start` stays: a grid row is as tall as its tallest cell, so
    // if a second column ever returns, a closed `<details>` would otherwise
    // stretch to match an open neighbour.
    const { container } = await renderView('awards');
    // Found by what it holds, not by a class, so a changed class list cannot
    // make the lookup miss and the assertions below pass on nothing.
    const grid = container.querySelector('details')?.parentElement;

    expect(grid).toBeTruthy();
    const classes = grid?.className.split(/\s+/) ?? [];
    expect(classes).toContain('lg:items-start');
    // No multi-column track at any breakpoint, bare or prefixed.
    expect(classes.filter((c) => /(^|:)(grid-cols|columns)-(?!1$)/.test(c))).toEqual([]);
  });
});
