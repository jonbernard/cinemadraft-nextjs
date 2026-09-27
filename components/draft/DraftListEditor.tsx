'use client';

import { useCallback, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { FilmSearch, type SearchedFilm } from '@/components/draft/FilmSearch';
import { EmptyState } from '@/components/ui/EmptyState';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { ReorderableList, type ReorderableRow } from '@/components/ui/ReorderableList';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils/cn';

/**
 * Written out rather than imported from the generated enum: importing the
 * repository that re-exports it would drag Prisma into the client bundle.
 */
export type DraftListStatus = 'none' | 'selected' | 'unavailable';

export type DraftListRow = {
  entryId: number;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  status: DraftListStatus;
  /** Null only for an entry whose film has left the catalogue. */
  movieId: number | null;
  /**
   * What this season's drafts say, which outranks `status`: the reader took it,
   * or `by` did — `gone` when it is gone in every league the reader drafts in.
   * Written out for the same reason as the status above.
   */
  drafted?: { yours: true } | { yours: false; by: string; gone: boolean };
};

const STATUS_LABEL: Record<DraftListStatus, string> = {
  none: 'No mark',
  selected: 'You took it',
  unavailable: 'Someone else took it',
};

const STATUSES: DraftListStatus[] = ['none', 'selected', 'unavailable'];

function isStatus(value: string): value is DraftListStatus {
  return STATUSES.includes(value as DraftListStatus);
}

/** A member's private shortlist, in the order they put it in. */
export function DraftListEditor({
  entries,
  onSearch,
  onAdd,
  onRemove,
  onSetStatus,
  onReorder,
  className,
}: {
  entries: readonly DraftListRow[];
  onSearch: (query: string) => Promise<ActionResult<SearchedFilm[]>>;
  onAdd: (film: { movieId?: number; tmdbId?: string }) => Promise<ActionResult<unknown>>;
  onRemove: (entryId: number) => Promise<ActionResult<unknown>>;
  onSetStatus: (
    entryId: number,
    status: DraftListStatus,
  ) => Promise<ActionResult<unknown>>;
  onReorder: (entryIds: number[]) => Promise<ActionResult<unknown>>;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [pending, startTransition] = useTransition();

  const onList = new Set(
    entries.flatMap((entry) => (entry.movieId == null ? [] : [entry.movieId])),
  );

  const search = useCallback(
    async (term: string): Promise<SearchedFilm[]> => {
      const result = await onSearch(term);
      // An empty list on a failure would read as "no film by that name".
      if (!result.ok) {
        setMessage(result.message);
        return [];
      }
      return result.data;
    },
    [onSearch],
  );

  const isOnList = useCallback(
    (film: SearchedFilm) => film.id != null && onList.has(film.id),
    [onList],
  );

  const add = useCallback(
    (film: SearchedFilm) => {
      if (pending) return;
      setMessage(null);

      startTransition(async () => {
        const result = await onAdd(
          film.id != null ? { movieId: film.id } : { tmdbId: film.tmdbId ?? '' },
        );

        if (!result.ok) {
          setMessage(result.message);
          return;
        }

        // Clears the field and returns focus to it — somebody adding a
        // shortlist is adding several films in a row.
        setResetSignal((signal) => signal + 1);
        setMessage(`${film.title} added`);
      });
    },
    [onAdd, pending],
  );

  const remove = useCallback(
    (entryId: number, title: string) => {
      startTransition(async () => {
        const result = await onRemove(entryId);
        setMessage(result.ok ? `${title} removed` : result.message);
      });
    },
    [onRemove],
  );

  const setStatus = useCallback(
    (entryId: number, status: DraftListStatus) => {
      startTransition(async () => {
        const result = await onSetStatus(entryId, status);
        if (!result.ok) setMessage(result.message);
      });
    },
    [onSetStatus],
  );

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <FilmSearch
        onSearch={search}
        onSelect={add}
        isUnavailable={isOnList}
        unavailableLabel="Already on your list"
        label="Add a film"
        busy={pending}
        resetSignal={resetSignal}
      />

      <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
        {pending ? 'Saving…' : (message ?? '')}
      </p>

      <ReorderableList
        items={entries}
        getId={entryId}
        droppableId="draft-list"
        label="Your list, best first — drag or use space and the arrow keys to reorder"
        itemClassName="border-border-rule border-b"
        empty={
          <EmptyState title="Nothing on your list yet">
            Search above for the films you want, then drag them into the order you would
            take them in. Only you ever see this.
          </EmptyState>
        }
        onReorder={onReorder}
      >
        {(entry, row) => (
          <EntryRow
            key={entry.entryId}
            entry={entry}
            row={row}
            onRemove={remove}
            onSetStatus={setStatus}
          />
        )}
      </ReorderableList>
    </div>
  );
}

/**
 * Its own component so each row's handlers are memoised against that row rather
 * than rebuilt for every row on every keystroke — the search field above
 * re-renders on each character typed, and a prepared list runs to dozens of
 * films.
 */
function EntryRow({
  entry,
  row,
  onRemove,
  onSetStatus,
}: {
  entry: DraftListRow;
  row: ReorderableRow;
  onRemove: (entryId: number, title: string) => void;
  onSetStatus: (entryId: number, status: DraftListStatus) => void;
}) {
  const remove = useCallback(
    () => onRemove(entry.entryId, entry.title),
    [onRemove, entry.entryId, entry.title],
  );

  const changeStatus = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (isStatus(event.target.value)) onSetStatus(entry.entryId, event.target.value);
    },
    [onSetStatus, entry.entryId],
  );

  const { faded, chip } = rowState(entry);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
      <div
        {...row.handleProps}
        // 🔴 A row with a select takes a whole line to itself below `sm`: at
        // 390px the select beside the title left it ~90px, and "Arrival"
        // clipped under it. The select and Remove wrap to the line below. A
        // row the drafts have marked has no select, so it stays on one line.
        className={cn(
          'focus-visible:outline-accent-fill flex min-h-11 min-w-0 grow items-center gap-3 px-2 focus-visible:outline-2',
          entry.drafted ? 'basis-0' : 'basis-full sm:basis-0',
        )}
      >
        {/* The position in the list, not the stored one: while a drag is in
            flight the two differ. */}
        <span className="text-text-dim tabular w-6 font-mono text-xs">
          {String(row.index + 1).padStart(2, '0')}
        </span>
        {/* 🔴 The fade is the poster's alone, never the row's. Text at 50% is
            4.67:1 on the dark panel but 3.37:1 on the light one, and the year
            and chip fall to about 2:1 in both — so the title steps down to
            `secondary` ink instead (7.35:1 dark, 6.78:1 light) and the chip
            says it in words. */}
        <span data-slot="poster" className={cn(faded && 'opacity-50')}>
          {entry.posterUrl ? (
            <RemoteImage
              src={entry.posterUrl}
              alt=""
              width={28}
              height={40}
              className="h-10 w-7 object-cover"
            />
          ) : (
            // The title's initials, beside the title: decoration, so hidden.
            <span
              aria-hidden
              className="bg-bg-surface text-text-dim grid h-10 w-7 place-items-center font-mono text-xs"
            >
              {entry.title.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>
        {/* The chip sits under the title rather than beside it: beside it, at
            390px, a one-word title ran underneath "Taken · Rhoda Vance". */}
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1 text-sm">
          <span>
            <span
              className={cn(
                'font-serif',
                faded ? 'text-text-secondary' : 'text-text-primary',
              )}
            >
              {entry.title}
            </span>
            {entry.releaseYear ? (
              <span className="text-text-dim tabular font-mono text-xs">
                {' '}
                {entry.releaseYear}
              </span>
            ) : null}
          </span>
          {/* Carmine marks *this one* — the film this member took. Gone to
              somebody else is information rather than urgency, so it is
              neutral. */}
          {chip ? <StatusChip tone={chip.tone}>{chip.label}</StatusChip> : null}
        </span>
      </div>

      {/* The manual mark is for drafts the app never saw. Once the board has
          the pick, a select that could contradict it is only a way to be
          wrong, so it goes. */}
      {entry.drafted ? null : (
        <label className="ml-auto flex items-center">
          <span className="sr-only">Mark {entry.title}</span>
          <select
            value={entry.status}
            onChange={changeStatus}
            className="border-border-rule bg-bg-surface text-text-secondary focus-visible:outline-accent-fill min-h-11 rounded-sm border text-xs focus-visible:outline-2"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        onClick={remove}
        aria-label={`Remove ${entry.title} from your list`}
        className="text-text-dim hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-3 text-xs focus-visible:outline-2"
      >
        Remove
      </button>
    </div>
  );
}

/**
 * The draft's record first, the manual mark second. "Someone else took it" by
 * hand fades exactly as the automatic kind does — it is the same fact, just
 * one the app was told rather than saw.
 */
function rowState(entry: DraftListRow): {
  faded: boolean;
  chip: { tone: 'carmine' | 'neutral'; label: string } | null;
} {
  const { drafted } = entry;
  if (drafted?.yours)
    return { faded: false, chip: { tone: 'carmine', label: STATUS_LABEL.selected } };
  if (drafted)
    return {
      faded: drafted.gone,
      chip: { tone: 'neutral', label: `Taken · ${drafted.by}` },
    };
  if (entry.status === 'selected') {
    return { faded: false, chip: { tone: 'carmine', label: STATUS_LABEL.selected } };
  }
  if (entry.status === 'unavailable') {
    return { faded: true, chip: { tone: 'neutral', label: STATUS_LABEL.unavailable } };
  }
  return { faded: false, chip: null };
}

function entryId(entry: DraftListRow): number {
  return entry.entryId;
}
