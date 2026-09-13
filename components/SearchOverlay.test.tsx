import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const findFilmsAction = vi.hoisted(() => vi.fn());
vi.mock('@/actions/search/find-films', () => ({ findFilmsAction }));

import { SearchOverlay } from './SearchOverlay';

/** A constant, not a literal in the JSX: Biome bans hardcoded `id` attributes. */
const SEARCH_ID = 'search';

const RESULT = {
  ok: true as const,
  data: [
    {
      id: 1,
      tmdbId: '550',
      title: 'Fight Club',
      year: 1999,
      posterUrl: null,
      isTaken: false,
      isLocal: true,
    },
  ],
};

describe('SearchOverlay', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('searches films and navigates to the one chosen', async () => {
    findFilmsAction.mockResolvedValue(RESULT);
    const user = userEvent.setup();
    render(<SearchOverlay id={SEARCH_ID} open />);

    await user.type(screen.getByRole('searchbox', { name: /find a film/i }), 'fight');
    await waitFor(() => expect(screen.getByText(/Fight Club/)).toBeInTheDocument());

    await user.click(screen.getByText(/Fight Club/));
    expect(push).toHaveBeenCalledWith('/films/550');
  });

  it('reports a failed search rather than rendering an empty grid', async () => {
    findFilmsAction.mockResolvedValue({
      ok: false,
      code: 'INVALID',
      message: 'search is unavailable',
    });
    const user = userEvent.setup();
    render(<SearchOverlay id={SEARCH_ID} open />);

    await user.type(screen.getByRole('searchbox', { name: /find a film/i }), 'fight');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/search is unavailable/i),
    );
  });

  it('closes on the first Escape, not the second', async () => {
    // The field is `<input type="search">`, and the browser spends the first
    // Escape clearing its value rather than letting the dialog's own cancel
    // through — so for anyone who had typed something, which is everyone,
    // "Escape closes" was two Escapes. jsdom reproduces neither native
    // behaviour, which is exactly why this asserts the panel's own handler:
    // one Escape from inside the field must call `close()`.
    findFilmsAction.mockResolvedValue(RESULT);
    const user = userEvent.setup();
    render(<SearchOverlay id={SEARCH_ID} open />);

    const box = screen.getByRole('searchbox', { name: /find a film/i });
    await user.type(box, 'fight');
    await waitFor(() => expect(screen.getByText(/Fight Club/)).toBeInTheDocument());

    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('shows the top nine, not everything the search returned', async () => {
    // Twenty rows hung the panel off the bottom of a 900px screen. Ranking
    // already put the answer first; the rest is noise the reader scrolls past.
    findFilmsAction.mockResolvedValue({
      ok: true,
      data: Array.from({ length: 20 }, (_, index) => ({
        id: index + 1,
        tmdbId: String(index + 1),
        title: `Result ${index + 1}`,
        year: 2000 + index,
        posterUrl: null,
        isTaken: false,
        isLocal: true,
      })),
    });
    const user = userEvent.setup();
    render(<SearchOverlay id={SEARCH_ID} open />);

    await user.type(screen.getByRole('searchbox', { name: /find a film/i }), 'result');
    await waitFor(() => expect(screen.getByText('Result 9')).toBeInTheDocument());

    expect(screen.queryByText('Result 10')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(9);
  });

  it('offers no link for a film TMDB does not know', async () => {
    findFilmsAction.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 7,
          tmdbId: null,
          title: 'Local Only',
          year: 2001,
          posterUrl: null,
          isTaken: false,
          isLocal: true,
        },
      ],
    });
    const user = userEvent.setup();
    render(<SearchOverlay id={SEARCH_ID} open />);

    await user.type(screen.getByRole('searchbox', { name: /find a film/i }), 'local');
    await waitFor(() => expect(screen.getByText('Not on TMDB')).toBeInTheDocument());

    await user.click(screen.getByText('Local Only'));
    expect(push).not.toHaveBeenCalled();
  });
});
