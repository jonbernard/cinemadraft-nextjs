'use client';

import { useCallback, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { EmptyState } from '@/components/EmptyState';
import { FilmSearch, type SearchedFilm } from '@/components/FilmSearch';
import { ReorderableList, type ReorderableRow } from '@/components/ReorderableList';
import { StatusChip } from '@/components/StatusChip';
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

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
      <div
        {...row.handleProps}
        className="focus-visible:outline-accent-fill flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 focus-visible:outline-2"
      >
        {/* The position in the list, not the stored one: while a drag is in
            flight the two differ. */}
        <span className="text-text-dim tabular w-6 font-mono text-xs">
          {String(row.index + 1).padStart(2, '0')}
        </span>
        {entry.posterUrl ? (
          // biome-ignore lint/performance/noImgElement: swapped for next/image in Phase 11 with the media migration
          <img src={entry.posterUrl} alt="" className="h-10 w-7 object-cover" />
        ) : (
          <span className="bg-bg-raised text-text-dim grid h-10 w-7 place-items-center font-mono text-[0.6rem]">
            {entry.title.slice(0, 2).toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1 text-sm">
          <span className="text-text-primary font-serif">{entry.title}</span>
          {entry.releaseYear ? (
            <span className="text-text-dim tabular font-mono text-xs">
              {' '}
              {entry.releaseYear}
            </span>
          ) : null}
        </span>
        {/* Carmine marks *this one* — the film this member took. Gone to
            somebody else is information rather than urgency, so it is neutral. */}
        {entry.status === 'selected' ? (
          <StatusChip tone="carmine">{STATUS_LABEL.selected}</StatusChip>
        ) : null}
        {entry.status === 'unavailable' ? (
          <StatusChip tone="neutral">{STATUS_LABEL.unavailable}</StatusChip>
        ) : null}
      </div>

      {/* Sets a state rather than toggling, so a member who marked the wrong row
          can put it back and two open tabs converge instead of fighting. */}
      <label className="flex items-center">
        <span className="sr-only">Mark {entry.title}</span>
        <select
          value={entry.status}
          onChange={changeStatus}
          className="border-border-rule bg-bg-raised text-text-secondary focus-visible:outline-accent-fill min-h-11 rounded-sm border px-2 text-xs focus-visible:outline-2"
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </label>

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

function entryId(entry: DraftListRow): number {
  return entry.entryId;
}
