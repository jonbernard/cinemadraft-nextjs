'use client';

import { useCallback, useId, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { FilmSearch, type SearchedFilm } from '@/components/FilmSearch';
import { PickList } from '@/components/PickList';
import { cn } from '@/lib/utils/cn';

/**
 * A search result the console can act on.
 *
 * `SearchedFilm` allows a null `id` — a film TMDB knows and this app has never
 * ingested. The console cannot draft one of those, so `assign` refuses it
 * rather than the type forbidding it: search returns what it finds, and
 * whether a given result is usable is this component's judgement to make.
 */
export type ConsoleFilm = SearchedFilm;

export type ConsoleSeatView = {
  draftId: number;
  name: string;
  isDummy: boolean;
  order: number;
  picks: { pickId: number; round: number; title: string; posterUrl: string | null }[];
};

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

  const [override, setOverride] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [pending, startTransition] = useTransition();

  // The override is the owner's, the suggestion is the snake's. Clearing the
  // override after a pick is what makes the turn advance on its own.
  const currentSeatId = override ?? suggestedSeatId;
  const currentSeat = seats.find((seat) => seat.draftId === currentSeatId) ?? null;
  const taken = new Set(takenMovieIds);

  const assign = useCallback(
    (film: SearchedFilm) => {
      // A TMDB-only film has no local id and cannot be drafted until it is
      // saved. Phase 8 leaves that path to the award admin; here it simply
      // cannot be selected.
      const movieId = film.id;
      if (!currentSeat || pending || movieId == null) return;
      setMessage(null);

      startTransition(async () => {
        const result = await onAssign({ draftId: currentSeat.draftId, movieId });

        if (!result.ok) {
          setMessage(result.message);
          return;
        }

        // Clears the field and returns focus to it — the next thing the owner
        // does is type the next title.
        setResetSignal((signal) => signal + 1);
        // Back to the snake's answer, which the refreshed props now reflect.
        setOverride(null);
        setMessage(`${film.title} → ${currentSeat.name}`);
        // Nothing refreshes the board by hand. `onAssign` is a Server Action,
        // and the revalidated tree comes back with its response, so the seats
        // and the suggestion arrive as new props.
      });
    },
    [currentSeat, onAssign, pending],
  );

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

  /** Adapts the action's `ActionResult` to what `FilmSearch` consumes. */
  const search = useCallback(
    async (term: string): Promise<SearchedFilm[]> => {
      const result = await onSearch(term);
      return result.ok ? result.data : [];
    },
    [onSearch],
  );

  const isTaken = useCallback(
    (film: SearchedFilm) => film.id != null && taken.has(film.id),
    [taken],
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

        <FilmSearch
          onSearch={search}
          onSelect={assign}
          isUnavailable={isTaken}
          disabled={!currentSeat}
          busy={pending}
          // The owner types the moment the page loads; anything else is a
          // click they should not have to make mid-call.
          autoFocus
          resetSignal={resetSignal}
        />

        <p
          id={`${listId}-status`}
          // Announced without stealing focus from the field.
          aria-live="polite"
          className="text-text-secondary min-h-5 text-xs"
        >
          {pending ? 'Saving…' : (message ?? '')}
        </p>

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
