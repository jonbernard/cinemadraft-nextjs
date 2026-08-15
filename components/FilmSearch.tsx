'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

export type SearchedFilm = {
  /** Null for a film TMDB knows and this app has never ingested. */
  id: number | null;
  /**
   * Optional: a local-only search never needs it, and it is used here solely
   * as a React key for results that have no local id yet.
   */
  tmdbId?: string | null;
  title: string;
  year: number | null;
  posterUrl: string | null;
};

/**
 * Find a film by typing part of its title (§10).
 *
 * Extracted from the draft console rather than written twice: the console and
 * the award-show admin are doing the same thing — someone says a title aloud
 * and it has to be found and attached in one action — and two implementations
 * would drift the moment one of them was improved.
 *
 * Three things make it usable at speed, and all three came from the draft call
 * the console was built for:
 *
 * - **Partial titles work**, because the person typing is repeating what they
 *   just heard, not reading from a screen.
 * - **The field never loses focus.** The next thing they do is type the next
 *   title.
 * - **The keyboard is enough on its own** — arrows move, Enter selects.
 *
 * Results are poster-first: this audience recognises films by artwork faster
 * than by title (§10).
 */
export function FilmSearch({
  onSearch,
  onSelect,
  isUnavailable,
  unavailableLabel = 'Taken',
  label = 'Find a film',
  placeholder = 'Part of the title is enough',
  disabled = false,
  busy = false,
  debounceMs = 180,
  resetSignal = 0,
  autoFocus = false,
  className,
}: {
  onSearch: (query: string, signal: AbortSignal) => Promise<SearchedFilm[]>;
  onSelect: (film: SearchedFilm) => void;
  /** Marks a film as present-but-unpickable — taken, or already nominated. */
  isUnavailable?: (film: SearchedFilm) => boolean;
  unavailableLabel?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** True while the caller is saving a selection. */
  busy?: boolean;
  debounceMs?: number;
  /**
   * Changing this clears the field and returns focus to it.
   *
   * A signal rather than an imperative handle: the parent knows when a
   * selection landed, and the alternative — a ref the parent calls into —
   * makes the parent responsible for *when* the field resets as well as
   * whether, which is how a stale query survives a save.
   */
  resetSignal?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedFilm[]>([]);
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    if (resetSignal === 0) return;
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }, [resetSignal]);

  useEffect(() => {
    const term = query.trim();
    if (term === '') {
      setResults([]);
      return;
    }

    // 🔴 A real cancellation, not just a flag on the response. Someone typing
    // "oppenheimer" fires a request per keystroke; without this the answer to
    // "opp" can land after the answer to "oppenheim" and replace it, so the
    // list flickers backwards while they are aiming at a row.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await onSearch(term, controller.signal);
        if (!controller.signal.aborted) {
          setResults(found);
          setHighlighted(0);
        }
      } catch {
        // An aborted request is the normal case here, not an error.
        if (!controller.signal.aborted) setResults([]);
      }
    }, debounceMs);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, onSearch, debounceMs]);

  const select = useCallback(
    (film: SearchedFilm) => {
      if (disabled || busy) return;
      if (isUnavailable?.(film)) return;
      onSelect(film);
    },
    [disabled, busy, isUnavailable, onSelect],
  );

  const onQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

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
        // An unavailable film is not selectable, and Enter must not be the one
        // path that forgets that.
        if (film) select(film);
      }
    },
    [results, highlighted, select],
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <label className="flex flex-col gap-2">
        <span className="text-text-dim text-xs uppercase tracking-wide">{label}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled}
          // biome-ignore lint/a11y/noAutofocus: single-purpose console, the field is the page
          autoFocus={autoFocus}
          onChange={onQueryChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-describedby={`${listId}-count`}
          className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill w-full border px-3 py-2 text-base focus-visible:outline-2"
        />
      </label>

      <span id={`${listId}-count`} className="sr-only" aria-live="polite">
        {results.length === 0 ? 'No films found' : `${results.length} films found`}
      </span>

      <ul className="flex flex-col gap-1">
        {results.map((film, index) => (
          <ResultRow
            key={film.tmdbId ?? film.id ?? film.title}
            film={film}
            index={index}
            unavailable={isUnavailable?.(film) === true}
            unavailableLabel={unavailableLabel}
            isHighlighted={index === highlighted}
            disabled={disabled || busy}
            onSelect={select}
            onHighlight={setHighlighted}
          />
        ))}
      </ul>
    </div>
  );
}

/** One result, selectable in a single click. */
function ResultRow({
  film,
  index,
  unavailable,
  unavailableLabel,
  isHighlighted,
  disabled,
  onSelect,
  onHighlight,
}: {
  film: SearchedFilm;
  index: number;
  unavailable: boolean;
  unavailableLabel: string;
  isHighlighted: boolean;
  disabled: boolean;
  onSelect: (film: SearchedFilm) => void;
  onHighlight: (index: number) => void;
}) {
  const select = useCallback(() => onSelect(film), [onSelect, film]);
  const highlight = useCallback(() => onHighlight(index), [onHighlight, index]);

  return (
    <li>
      <button
        type="button"
        disabled={unavailable || disabled}
        onClick={select}
        onMouseEnter={highlight}
        className={cn(
          'flex w-full items-center gap-3 px-2 py-2 text-left',
          isHighlighted && 'bg-bg-raised',
          unavailable && 'opacity-50',
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
        {/* Stated, not implied by dimming — the person must not have to
            remember what went three seats ago. */}
        {unavailable ? (
          <span className="text-text-dim text-xs uppercase tracking-wide">
            {unavailableLabel}
          </span>
        ) : null}
      </button>
    </li>
  );
}
