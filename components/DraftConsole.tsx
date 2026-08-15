'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { PickList } from '@/components/PickList';
import { cn } from '@/lib/utils/cn';

export type ConsoleFilm = {
  id: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
};

export type ConsoleSeatView = {
  draftId: number;
  name: string;
  isDummy: boolean;
  order: number;
  picks: { pickId: number; round: number; title: string; posterUrl: string | null }[];
};

/** How long the field waits after a keystroke before asking the server. */
const SEARCH_DEBOUNCE_MS = 180;

/**
 * One seat in the running order, and the way the owner overrules it.
 *
 * Its own component so the click handler can be memoised against the seat
 * rather than rebuilt for every seat on every keystroke — the field above it
 * re-renders on each character typed, and this list sits beside it.
 */
function SeatButton({
  seat,
  isCurrent,
  onSelect,
}: {
  seat: ConsoleSeatView;
  isCurrent: boolean;
  onSelect: (draftId: number) => void;
}) {
  // Overriding is a click. Someone is always away from the call, and a console
  // that could only run in sequence would make their pick impossible to enter.
  const select = useCallback(() => onSelect(seat.draftId), [onSelect, seat.draftId]);

  return (
    <li>
      <button
        type="button"
        onClick={select}
        aria-current={isCurrent ? 'true' : undefined}
        className={cn(
          'border-border-rule flex w-full items-baseline justify-between gap-3 border-b px-2 py-3 text-left',
          isCurrent && 'border-l-accent-fill bg-bg-raised border-l-2',
        )}
      >
        <span className="text-text-primary text-sm">
          {seat.name}
          {/* Named, never colour alone (a11y: colour-not-only). */}
          {isCurrent ? <span className="text-accent-text"> · picking now</span> : null}
          {seat.isDummy ? <span className="text-text-dim"> · unclaimed</span> : null}
        </span>
        <span className="text-text-secondary tabular font-mono text-xs">
          {seat.picks.length}
        </span>
      </button>
    </li>
  );
}

/** One search result, assignable in a single click. */
function ResultRow({
  film,
  index,
  isTaken,
  isHighlighted,
  disabled,
  onAssign,
  onHighlight,
}: {
  film: ConsoleFilm;
  index: number;
  isTaken: boolean;
  isHighlighted: boolean;
  disabled: boolean;
  onAssign: (film: ConsoleFilm) => void;
  onHighlight: (index: number) => void;
}) {
  const assign = useCallback(() => onAssign(film), [onAssign, film]);
  const highlight = useCallback(() => onHighlight(index), [onHighlight, index]);

  return (
    <li>
      <button
        type="button"
        disabled={isTaken || disabled}
        onClick={assign}
        onMouseEnter={highlight}
        className={cn(
          'flex w-full items-center gap-3 px-2 py-2 text-left',
          isHighlighted && 'bg-bg-raised',
          isTaken && 'opacity-50',
        )}
      >
        {film.posterUrl ? (
          // biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11 with the media migration
          <img src={film.posterUrl} alt="" className="h-12 w-8 object-cover" />
        ) : (
          <span className="bg-bg-raised text-text-dim grid h-12 w-8 place-items-center font-mono text-[0.6rem]">
            {film.title.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="text-text-primary flex-1 text-sm">
          {film.title}
          {film.year ? (
            <span className="text-text-dim tabular font-mono"> {film.year}</span>
          ) : null}
        </span>
        {/* Stated, not implied by dimming — the owner must not have to
            remember what went three seats ago. */}
        {isTaken ? (
          <span className="text-text-dim text-xs uppercase tracking-wide">Taken</span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * The owner's console, used once a year, live, with the league watching.
 *
 * 🔴 **Desktop-first, and that is the one exception to D49.** Everything else
 * in the app is built for a phone first because that is where members read it;
 * this is run from a laptop on a video call, one person, hands on a keyboard.
 * Optimising it for a phone would cost the thing it exists for.
 *
 * It has to be good at exactly three things (D46), and nothing else on the
 * page competes with them:
 *
 * 1. **Whose turn it is** — the running order, current seat unmistakable,
 *    advancing on its own and overridable by clicking a seat.
 * 2. **Finding the film** — the owner is typing what someone just said aloud,
 *    so partial titles work and the field never loses focus.
 * 3. **Assigning it** — one action. Enter takes the highlighted result.
 *
 * **The board is not duplicated here.** The seat list shows what each seat
 * holds, and the board itself is the public page the league is already
 * watching. Two renderings of the same thing on one screen would be two things
 * to keep in step.
 *
 * State is deliberately thin: the seats and the suggestion are props, and a
 * successful pick clears the override and refreshes rather than patching a
 * local copy. That is what lets phase 14 make the same props arrive over a
 * live connection (D48) without touching this component.
 */
export function DraftConsole({
  seats,
  suggestedSeatId,
  takenMovieIds,
  onSearch,
  onAssign,
  onReorder,
  className,
}: {
  seats: readonly ConsoleSeatView[];
  suggestedSeatId: number | null;
  takenMovieIds: readonly number[];
  onSearch: (query: string) => Promise<ActionResult<ConsoleFilm[]>>;
  onAssign: (input: {
    draftId: number;
    movieId: number;
  }) => Promise<ActionResult<{ pickId: number }>>;
  onReorder: (input: {
    draftId: number;
    pickIds: number[];
  }) => Promise<ActionResult<null>>;
  className?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConsoleFilm[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [override, setOverride] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The override is the owner's, the suggestion is the snake's. Clearing the
  // override after a pick is what makes the turn advance on its own.
  const currentSeatId = override ?? suggestedSeatId;
  const currentSeat = seats.find((seat) => seat.draftId === currentSeatId) ?? null;
  const taken = new Set(takenMovieIds);

  useEffect(() => {
    const term = query.trim();
    if (term === '') {
      setResults([]);
      return;
    }

    let live = true;
    const timer = setTimeout(async () => {
      const result = await onSearch(term);
      // A slower earlier request must not overwrite a newer one — the owner is
      // typing fast and the results would flicker backwards.
      if (!live) return;
      setResults(result.ok ? result.data : []);
      setHighlighted(0);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, onSearch]);

  const assign = useCallback(
    (film: ConsoleFilm) => {
      if (!currentSeat || pending) return;
      setMessage(null);

      startTransition(async () => {
        const result = await onAssign({ draftId: currentSeat.draftId, movieId: film.id });

        if (!result.ok) {
          setMessage(result.message);
          return;
        }

        setQuery('');
        setResults([]);
        // Back to the snake's answer, which the refreshed props now reflect.
        setOverride(null);
        setMessage(`${film.title} → ${currentSeat.name}`);
        // Nothing refreshes the board by hand. `onAssign` is a Server Action,
        // and the revalidated tree comes back with its response, so the seats
        // and the suggestion arrive as new props.
        // The next thing the owner does is type the next title.
        inputRef.current?.focus();
      });
    },
    [currentSeat, onAssign, pending],
  );

  const onQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const reorderCurrentSeat = useCallback(
    async (pickIds: number[]) => {
      if (!currentSeat)
        return {
          ok: false as const,
          code: 'INVALID' as const,
          message: 'no seat selected',
        };
      return onReorder({ draftId: currentSeat.draftId, pickIds });
    },
    [currentSeat, onReorder],
  );

  /**
   * The whole console is drivable from the field: arrows move through the
   * results, Enter takes the highlighted one. The owner is typing what someone
   * said aloud and then confirming it — reaching for the mouse between every
   * pick is the thing this avoids.
   */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (results.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlighted((index) => Math.min(index + 1, results.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const film = results[highlighted];
        // A taken film is not assignable, and Enter must not be the one path
        // that forgets that.
        if (film && !takenMovieIds.includes(film.id)) assign(film);
      }
    },
    [results, highlighted, takenMovieIds, assign],
  );

  return (
    <div className={cn('grid gap-8 lg:grid-cols-[20rem_1fr]', className)}>
      {/* Running order. */}
      <section aria-labelledby={`${listId}-order`} className="flex flex-col gap-3">
        <h2
          id={`${listId}-order`}
          className="text-text-dim text-xs font-normal uppercase tracking-wide"
        >
          Running order
        </h2>

        <ul className="flex flex-col">
          {seats.map((seat) => (
            <SeatButton
              key={seat.draftId}
              seat={seat}
              isCurrent={seat.draftId === currentSeatId}
              onSelect={setOverride}
            />
          ))}
        </ul>
      </section>

      {/* Search and assign. */}
      <section aria-labelledby={`${listId}-pick`} className="flex flex-col gap-4">
        <h2 id={`${listId}-pick`} className="text-text-primary text-lg">
          {currentSeat ? `Pick for ${currentSeat.name}` : 'Every seat is up to date'}
        </h2>

        <label className="flex flex-col gap-2">
          <span className="text-text-dim text-xs uppercase tracking-wide">
            Find a film
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            disabled={!currentSeat}
            // The owner types the moment the page loads; anything else is a
            // click they should not have to make mid-call.
            // biome-ignore lint/a11y/noAutofocus: single-purpose console, the field is the page
            autoFocus
            onChange={onQueryChange}
            onKeyDown={onKeyDown}
            placeholder="Part of the title is enough"
            aria-describedby={`${listId}-status`}
            className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill w-full border px-3 py-2 text-base focus-visible:outline-2"
          />
        </label>

        <p
          id={`${listId}-status`}
          // Announced without stealing focus from the field.
          aria-live="polite"
          className="text-text-secondary min-h-5 text-xs"
        >
          {pending ? 'Saving…' : (message ?? '')}
        </p>

        <ul className="flex flex-col gap-1">
          {results.map((film, index) => (
            <ResultRow
              key={film.id}
              film={film}
              index={index}
              isTaken={taken.has(film.id)}
              isHighlighted={index === highlighted}
              disabled={!currentSeat || pending}
              onAssign={assign}
              onHighlight={setHighlighted}
            />
          ))}
        </ul>

        {currentSeat ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-text-dim text-xs font-normal uppercase tracking-wide">
              {currentSeat.name}’s picks
            </h3>
            {/* Correcting a round is a separate act from taking a film, and it
                happens after the fact — usually because a pick went in against
                the wrong round mid-call. */}
            <PickList picks={currentSeat.picks} onReorder={reorderCurrentSeat} />
          </section>
        ) : null}
      </section>
    </div>
  );
}
