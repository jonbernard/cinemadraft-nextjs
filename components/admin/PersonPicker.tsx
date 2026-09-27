'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import type { FilmPerson } from '@/actions/awards/film-people';
import { cn } from '@/lib/utils/cn';

/** Lowercased and stripped of accents, so "skarsgard" finds Skarsgård. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** What a row says under the name: the character, or the jobs. */
function roleOf(person: FilmPerson): string | null {
  if (person.kind === 'cast') return person.character ? `as ${person.character}` : 'Cast';
  return person.jobs;
}

/**
 * Every word typed has to appear somewhere in the person's name, character or
 * jobs — so "director" finds the director and "penn lockjaw" finds one row.
 */
function filterPeople(
  people: readonly FilmPerson[],
  query: string,
): readonly FilmPerson[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return people;
  return people.filter((person) => {
    const haystack = fold(
      [person.name, person.character ?? '', person.jobs ?? ''].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Choose the person a nomination names, from the film's own credits (§12).
 *
 * The source app's picker, kept: one list of cast and crew, typing filters it,
 * choosing attaches (`panelNominations.js`). 🔴 **There is no free-text
 * fallback**, on the owner's word that TMDB's credits have never failed to
 * hold the person — a typed name is how a nomination ends up with no
 * `detail_id` and a spelling nobody else uses.
 *
 * The keyboard is enough on its own, as in `FilmSearch` beside it: arrows move,
 * Enter chooses, Escape goes back to choosing the film.
 */
export function PersonPicker({
  people,
  onSelect,
  onCancel,
  isUnavailable,
  unavailableLabel = 'Nominated',
  label = 'Person nominated',
  busy = false,
  autoFocus = false,
  className,
}: {
  people: readonly FilmPerson[];
  onSelect: (person: FilmPerson) => void;
  /** Escape — back to the film. */
  onCancel?: () => void;
  /** A person already nominated for this film in this category. */
  isUnavailable?: (person: FilmPerson) => boolean;
  unavailableLabel?: string;
  label?: string;
  busy?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  const shown = useMemo(() => filterPeople(people, query), [people, query]);

  // Keep the highlighted row in view as the arrows walk a long cast list.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${highlighted}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [highlighted]);

  const select = useCallback(
    (person: FilmPerson) => {
      if (busy || isUnavailable?.(person)) return;
      onSelect(person);
    },
    [busy, isUnavailable, onSelect],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape' && onCancel) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (shown.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlighted((index) => Math.min(index + 1, shown.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted((index) => Math.max(index - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const person = shown[highlighted];
        if (person) select(person);
      }
    },
    [shown, highlighted, select, onCancel],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="flex flex-col gap-2">
        <span className="text-text-secondary text-sm">{label}</span>
        <input
          type="search"
          value={query}
          // biome-ignore lint/a11y/noAutofocus: the film was just chosen, and the name is the next thing typed
          autoFocus={autoFocus}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Type to filter the cast and crew"
          aria-describedby={`${listId}-count`}
          className="border-border-rule bg-bg-surface text-text-primary focus-visible:outline-accent-fill w-full border px-3 py-2 text-base focus-visible:outline-2"
        />
      </label>

      <span id={`${listId}-count`} className="sr-only" aria-live="polite">
        {shown.length === 1 ? '1 person' : `${shown.length} people`}
      </span>

      {shown.length === 0 ? (
        <p className="text-text-secondary text-sm">
          Nobody in this film’s credits matches “{query.trim()}”.
        </p>
      ) : (
        <ul
          ref={listRef}
          aria-label="Cast and crew"
          className="flex max-h-80 flex-col gap-1 overflow-y-auto"
        >
          {shown.map((person, index) => (
            <PersonRow
              key={`${person.kind}-${person.id}`}
              person={person}
              index={index}
              unavailable={isUnavailable?.(person) === true}
              unavailableLabel={unavailableLabel}
              isHighlighted={index === highlighted}
              disabled={busy}
              onSelect={select}
              onHighlight={setHighlighted}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonRow({
  person,
  index,
  unavailable,
  unavailableLabel,
  isHighlighted,
  disabled,
  onSelect,
  onHighlight,
}: {
  person: FilmPerson;
  index: number;
  unavailable: boolean;
  unavailableLabel: string;
  isHighlighted: boolean;
  disabled: boolean;
  onSelect: (person: FilmPerson) => void;
  onHighlight: (index: number) => void;
}) {
  const role = roleOf(person);
  return (
    <li data-index={index}>
      <button
        type="button"
        disabled={unavailable || disabled}
        onClick={() => onSelect(person)}
        onMouseEnter={() => onHighlight(index)}
        className={cn(
          'hover:bg-bg-surface focus-visible:outline-accent-fill flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-2 text-left focus-visible:outline-2 disabled:cursor-default disabled:hover:bg-transparent',
          isHighlighted && 'bg-bg-surface',
          unavailable && 'opacity-60',
        )}
      >
        <span className="flex flex-1 flex-col">
          <span className="text-text-primary font-serif text-sm leading-tight">
            {person.name}
          </span>
          {role ? <span className="text-text-secondary text-xs">{role}</span> : null}
        </span>
        {/* Stated, not implied by dimming. */}
        {unavailable ? (
          <span className="text-text-secondary text-xs">{unavailableLabel}</span>
        ) : null}
      </button>
    </li>
  );
}
