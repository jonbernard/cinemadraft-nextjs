import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilmSearch, type SearchedFilm } from '@/components/FilmSearch';

/**
 * The typeahead, extracted from the draft console so the award-show admin can
 * use the same one (§10).
 *
 * The console's own tests still pass untouched, which is the proof the
 * extraction changed nothing. What is tested *here* is the thing the console
 * never had: real request cancellation.
 */
const FILMS: SearchedFilm[] = [
  { id: 1, tmdbId: '1', title: 'One Battle After Another', year: 2025, posterUrl: null },
  { id: 2, tmdbId: '2', title: 'Battleship Potemkin', year: 1925, posterUrl: null },
];

function setup(over: Partial<React.ComponentProps<typeof FilmSearch>> = {}) {
  const onSearch = vi.fn(async () => FILMS);
  const onSelect = vi.fn();
  render(<FilmSearch onSearch={onSearch} onSelect={onSelect} debounceMs={5} {...over} />);
  return { onSearch, onSelect, user: userEvent.setup() };
}

describe('FilmSearch', () => {
  it('searches on a fragment and lists what it finds', async () => {
    const { onSearch, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');

    await waitFor(() => expect(onSearch).toHaveBeenCalled());
    expect(await screen.findByText('One Battle After Another')).toBeInTheDocument();
  });

  it('does not ask the server for an empty box', async () => {
    const { onSearch, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'a');
    await user.clear(screen.getByRole('searchbox'));

    await waitFor(() => expect(screen.queryByText('Battleship Potemkin')).toBeNull());
    expect(onSearch).not.toHaveBeenCalledWith('', expect.anything());
  });

  it('selects with a click', async () => {
    const { onSelect, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');
    await user.click(await screen.findByRole('button', { name: /Battleship/ }));

    expect(onSelect).toHaveBeenCalledWith(FILMS[1]);
  });

  it('🔴 selects from the keyboard alone', async () => {
    const { onSelect, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');
    await screen.findByText('Battleship Potemkin');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(FILMS[1]);
  });

  it('🔴 refuses an unavailable film by click and by Enter alike', async () => {
    const { onSelect, user } = setup({
      isUnavailable: (film) => film.id === 1,
      unavailableLabel: 'Taken',
    });

    await user.type(screen.getByRole('searchbox'), 'battle');
    const gone = await screen.findByRole('button', { name: /One Battle After Another/ });

    expect(gone).toHaveTextContent('Taken');
    expect(gone).toBeDisabled();

    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('🔴 ignores a stale response that lands after a newer one', async () => {
    // Someone typing "oppenheimer" fires a request per keystroke. Without
    // cancellation the answer to "opp" can arrive after the answer to
    // "oppenheim" and replace it, so the list flickers backwards while they
    // are aiming at a row.
    const slow: SearchedFilm[] = [
      { id: 9, tmdbId: '9', title: 'Stale Result', year: null, posterUrl: null },
    ];
    let resolveFirst = (): void => {};

    const onSearch = vi.fn((query: string) => {
      if (query === 'opp') {
        return new Promise<SearchedFilm[]>((resolve) => {
          resolveFirst = () => resolve(slow);
        });
      }
      return Promise.resolve(FILMS);
    });

    render(<FilmSearch onSearch={onSearch} onSelect={vi.fn()} debounceMs={1} />);
    const user = userEvent.setup();

    await user.type(screen.getByRole('searchbox'), 'opp');
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('opp', expect.anything()));

    await user.type(screen.getByRole('searchbox'), 'enheim');
    expect(await screen.findByText('One Battle After Another')).toBeInTheDocument();

    // The first request finally answers. It must be ignored.
    resolveFirst();

    await waitFor(() => expect(screen.queryByText('Stale Result')).toBeNull());
    expect(screen.getByText('One Battle After Another')).toBeInTheDocument();
  });

  it('🔴 passes an abort signal, so a real request can be cancelled', async () => {
    // The stale-response test proves the result is discarded. This proves the
    // in-flight request is actually cancelled rather than merely ignored —
    // otherwise every keystroke leaves a request running to completion.
    const { onSearch, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'ba');
    await waitFor(() => expect(onSearch).toHaveBeenCalled());
    const signal = onSearch.mock.calls.at(0)?.at(1) as unknown as AbortSignal;

    await user.type(screen.getByRole('searchbox'), 'ttle');

    await waitFor(() => expect(signal.aborted).toBe(true));
  });

  it('clears the field and takes focus when the reset signal changes', async () => {
    // How the parent says "that selection landed" — the next thing the person
    // does is type the next title.
    const props = {
      onSearch: vi.fn(async () => FILMS),
      onSelect: vi.fn(),
      debounceMs: 5,
    };
    const { rerender } = render(<FilmSearch {...props} resetSignal={0} />);
    const user = userEvent.setup();

    const box = screen.getByRole('searchbox');
    await user.type(box, 'battle');
    expect(box).toHaveValue('battle');

    rerender(<FilmSearch {...props} resetSignal={1} />);

    await waitFor(() => expect(box).toHaveValue(''));
    expect(box).toHaveFocus();
  });

  it('announces the result count without stealing focus', async () => {
    const { user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');

    expect(await screen.findByText('2 films found')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
});
