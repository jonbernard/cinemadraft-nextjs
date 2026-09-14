import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  type ConsoleFilm,
  type ConsoleSeatView,
  DraftConsole,
} from '@/components/draft/DraftConsole';

/**
 * The console is used once a year, live, with a dozen people waiting on every
 * pick. What is tested here is what makes that survivable: the turn is right,
 * the search finds a film from a fragment of its title, a pick takes one
 * action, and a film that is gone says so.
 */
const FILMS: ConsoleFilm[] = [
  { id: 1, title: 'One Battle After Another', year: 2025, posterUrl: null },
  { id: 2, title: 'Battleship Potemkin', year: 1925, posterUrl: null },
];

function seats(counts: readonly number[]): ConsoleSeatView[] {
  return counts.map((count, index) => ({
    draftId: 100 + index,
    name: `Seat ${index + 1}`,
    isDummy: false,
    order: index + 1,
    picks: Array.from({ length: count }, (_, round) => ({
      pickId: 1000 + index * 10 + round,
      round: round + 1,
      title: `Film ${round + 1}`,
      posterUrl: null,
    })),
  }));
}

function setup(over: Partial<React.ComponentProps<typeof DraftConsole>> = {}) {
  const onSearch = vi.fn(async () => ({ ok: true as const, data: FILMS }));
  const onAssign = vi.fn(async () => ({ ok: true as const, data: { pickId: 7 } }));
  const onReorder = vi.fn(async () => ({ ok: true as const, data: null }));

  const props = {
    seats: seats([0, 0, 0]),
    suggestedSeatId: 100,
    takenMovieIds: [] as number[],
    onSearch,
    onAssign,
    onReorder,
    ...over,
  };

  render(<DraftConsole {...props} />);
  return { onSearch, onAssign, onReorder, user: userEvent.setup() };
}

/** The seat the console says is picking. */
function currentSeatName() {
  const current = screen
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-current') === 'true');
  return current?.textContent ?? null;
}

describe('DraftConsole — whose turn', () => {
  it('shows the suggested seat as the one picking', () => {
    setup();

    expect(currentSeatName()).toContain('Seat 1');
    // Named, not merely tinted: colour alone would be invisible to a
    // colour-blind reader.
    expect(currentSeatName()).toContain('On the clock');
    expect(screen.getByRole('heading', { name: 'Pick for Seat 1' })).toBeInTheDocument();
  });

  it('lets the owner override it', async () => {
    // Someone is always away from the call. A console that could only run in
    // sequence would make their pick impossible to enter.
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Seat 3/ }));

    expect(currentSeatName()).toContain('Seat 3');
    expect(screen.getByRole('heading', { name: 'Pick for Seat 3' })).toBeInTheDocument();
  });

  it('follows the suggestion again once a pick lands', async () => {
    // The override is for one pick, not for the rest of the draft — the
    // server's next suggestion arrives as a prop and takes over again.
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /Seat 2/ }));
    expect(currentSeatName()).toContain('Seat 2');

    await user.type(screen.getByRole('searchbox'), 'battle');
    await user.click(await screen.findByRole('button', { name: /Battleship/ }));

    await waitFor(() => expect(currentSeatName()).toContain('Seat 1'));
  });

  it('says so when every seat is level and nobody is up', () => {
    setup({ suggestedSeatId: null });

    expect(
      screen.getByRole('heading', { name: 'Every seat is up to date' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeDisabled();
  });

  it('counts each seat’s picks without assuming a roster size (D34)', () => {
    setup({ seats: seats([30, 6, 0]) });

    // The running order is the first list; the second is the search results.
    const order = screen.getAllByRole('list')[0] as HTMLElement;
    expect(within(order).getByRole('button', { name: /Seat 1/ })).toHaveTextContent('30');
    expect(within(order).getByRole('button', { name: /Seat 2/ })).toHaveTextContent('6');
  });
});

describe('DraftConsole — finding a film', () => {
  it('searches on a fragment of the title', async () => {
    // The owner is typing what someone just said out loud.
    const { onSearch, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');

    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('battle'));
    expect(await screen.findByText('One Battle After Another')).toBeInTheDocument();
  });

  it('does not ask the server for an empty box', async () => {
    const { onSearch, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'a');
    await user.clear(screen.getByRole('searchbox'));

    await waitFor(() => expect(screen.queryByText('Battleship Potemkin')).toBeNull());
    expect(onSearch).not.toHaveBeenCalledWith('');
  });

  it('marks a film that is already gone and refuses to assign it', async () => {
    // Mid-call the owner must not have to remember whether a film went three
    // seats ago.
    const { onAssign, user } = setup({ takenMovieIds: [1] });

    await user.type(screen.getByRole('searchbox'), 'battle');
    const taken = await screen.findByRole('button', { name: /One Battle After Another/ });

    expect(taken).toHaveTextContent('Taken');
    expect(taken).toBeDisabled();
    expect(onAssign).not.toHaveBeenCalled();
  });
});

describe('DraftConsole — assigning', () => {
  it('assigns the film to the seat that is picking', async () => {
    const { onAssign, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');
    await user.click(await screen.findByRole('button', { name: /Battleship/ }));

    expect(onAssign).toHaveBeenCalledWith({ draftId: 100, movieId: 2 });
  });

  it('assigns from the keyboard alone', async () => {
    // Arrow to the film, Enter to take it — the owner's hands do not leave the
    // keyboard between picks.
    const { onAssign, user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');
    await screen.findByText('Battleship Potemkin');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onAssign).toHaveBeenCalledWith({ draftId: 100, movieId: 2 });
  });

  it('Enter refuses a taken film like the click does', async () => {
    const { onAssign, user } = setup({ takenMovieIds: [1] });

    await user.type(screen.getByRole('searchbox'), 'battle');
    await screen.findByText('One Battle After Another');
    await user.keyboard('{Enter}');

    expect(onAssign).not.toHaveBeenCalled();
  });

  it('clears the field and keeps focus for the next pick', async () => {
    const { user } = setup();

    await user.type(screen.getByRole('searchbox'), 'battle');
    await user.click(await screen.findByRole('button', { name: /Battleship/ }));

    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue(''));
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('reports a refusal instead of pretending the pick landed', async () => {
    const onAssign = vi.fn(async () => ({
      ok: false as const,
      code: 'CONFLICT' as const,
      message: 'Paterson is already taken in this group',
    }));
    const { user } = setup({ onAssign });

    await user.type(screen.getByRole('searchbox'), 'battle');
    await user.click(await screen.findByRole('button', { name: /Battleship/ }));

    expect(
      await screen.findByText('Paterson is already taken in this group'),
    ).toBeInTheDocument();
    // The query survives, so the owner can pick a different film without
    // typing the title again.
    expect(screen.getByRole('searchbox')).toHaveValue('battle');
  });

  it('drafts a film TMDB knows and this app has never ingested', async () => {
    // 🔴 `id` is null and `tmdbId` is set — a film the search found on TMDB.
    // This used to be REFUSED with "an admin has to add it before it can be
    // drafted", which was true when written and stopped being true when
    // `addPick` learned to take a `tmdbId` and ingest through
    // `lib/services/film-ingest.ts`. The owner hit the stale refusal mid-draft.
    // Choosing a result IS the act of adding the film.
    const { onAssign, user } = setup({
      onSearch: vi.fn(async () => ({
        ok: true as const,
        data: [
          { id: null, tmdbId: '550', title: 'Fight Club', year: 1999, posterUrl: null },
        ] as ConsoleFilm[],
      })),
    });

    await user.type(screen.getByRole('searchbox'), 'fight');
    await user.click(await screen.findByRole('button', { name: /Fight Club/ }));

    // By tmdbId, and with no movieId alongside it — the server resolves one or
    // the other, and sending both would make the payload say two things.
    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith({
        draftId: expect.any(Number),
        tmdbId: '550',
      });
    });
    expect(await screen.findByText(/Fight Club →/)).toBeInTheDocument();
  });

  it('still prefers the local id when the film is already cached', async () => {
    // 🔴 The other half, and not decoration: a branch that sent `tmdbId` for
    // every film would pass the case above while making every ordinary pick
    // take the ingest path.
    const { onAssign, user } = setup({
      onSearch: vi.fn(async () => ({
        ok: true as const,
        data: [
          { id: 77, tmdbId: '550', title: 'Fight Club', year: 1999, posterUrl: null },
        ] as ConsoleFilm[],
      })),
    });

    await user.type(screen.getByRole('searchbox'), 'fight');
    await user.click(await screen.findByRole('button', { name: /Fight Club/ }));

    await waitFor(() => {
      expect(onAssign).toHaveBeenCalledWith({
        draftId: expect.any(Number),
        movieId: 77,
      });
    });
  });

  it('says which film had no seat, rather than returning silently', () => {
    // With no seat the console says so in the heading *and* the field is
    // disabled, so the owner is never left pressing Enter into nothing. The
    // message branch behind it covers the race where a seat disappears between
    // the render the owner is looking at and the Enter they just pressed,
    // which jsdom cannot stage — that half is proved in a browser.
    setup({ suggestedSeatId: null });

    expect(
      screen.getByRole('heading', { name: /every seat is up to date/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeDisabled();
  });

  it('numbers each seat with its position in the running order', () => {
    // 🔴 The list was sorted by `order` and headed "Running order" but showed
    // no number, so the snake could not be checked against anything. The owner
    // reported a turn sequence that "seemed odd"; it was correct, and there
    // was simply no evidence on screen either way.
    setup();

    // The `<section aria-labelledby>` is the labelled thing, so it is a
    // region; the `<ul>` inside carries no name of its own.
    const order = screen.getByRole('region', { name: /running order/i });
    const seats = within(order).getAllByRole('listitem');
    expect(seats[0]).toHaveTextContent('01');
    expect(seats[1]).toHaveTextContent('02');
    // Spoken, not just shown: "02" alone names nothing.
    expect(within(order).getByText('Position 1')).toBeInTheDocument();
  });
});
