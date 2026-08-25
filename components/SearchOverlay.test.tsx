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
