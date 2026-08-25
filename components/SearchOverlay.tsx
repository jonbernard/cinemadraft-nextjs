'use client';

import { useRouter } from 'next/navigation';
import type { Ref } from 'react';
import { useCallback, useRef, useState } from 'react';

import { findFilmsAction } from '@/actions/search/find-films';
import { FilmSearch, type SearchedFilm } from './FilmSearch';

/**
 * The global film search, as a panel over whatever page is open (P15.T3).
 *
 * 🔴 **Search is not `/browse`.** The chrome's search icon used to link to the
 * release calendar, which is ordered by date and cannot answer "where is
 * *Sinners*" — the one question the icon promises. This panel answers it from
 * anywhere in the app and returns the reader to where they were.
 *
 * 🔴 **A native `<dialog>` opened with `showModal()` (D75)**, the second
 * consumer of the pattern `MoreSheet` established rather than a second
 * implementation of it: the focus trap, `Escape`, the inert background and the
 * backdrop are all the platform's job.
 *
 * `FilmSearch` is reused unmodified — it already debounces, aborts in-flight
 * requests, moves with arrows, selects with Enter and never drops focus, and
 * its rows are poster-first. A second typeahead here would drift from the
 * draft console's the first time either was improved.
 *
 * A result with no `tmdbId` (a local row ingested before TMDB ids were
 * captured) has nowhere to link to, so it renders unselectable and says "Not
 * on TMDB" rather than being hidden: hiding it makes the search look broken to
 * the one person who knows the film is in the app.
 *
 * There is no result count and no submit button. Enter already selects, and a
 * button that repeats it is a second way to be wrong.
 */
export function SearchOverlay({
  id,
  ref,
  open = false,
}: {
  id: string;
  ref?: Ref<HTMLDialogElement>;
  /** Test/story only: renders the dialog open without `showModal()`, which jsdom does not implement. */
  open?: boolean;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [empty, setEmpty] = useState(false);

  const onSearch = useCallback(async (query: string, signal: AbortSignal) => {
    const result = await findFilmsAction({ query, context: { kind: 'browse' } });
    // The typeahead fires one request per keystroke; an answer that arrives
    // after its own abort must not repaint the panel behind a newer one.
    if (signal.aborted) return [];

    setSearched(true);
    if (!result.ok) {
      setError(result.message);
      setEmpty(false);
      return [];
    }

    setError(null);
    setEmpty(result.data.length === 0);
    return result.data;
  }, []);

  const onSelect = useCallback(
    (film: SearchedFilm) => {
      if (!film.tmdbId) return;
      router.push(`/films/${film.tmdbId}`);
      dialog.current?.close();
    },
    [router],
  );

  return (
    <dialog
      id={id}
      open={open}
      ref={mergeRefs(dialog, ref)}
      aria-label="Search films"
      // Top-aligned rather than centred: the panel reads as a search bar
      // dropping out of the chrome the icon lives in, not as a modal that
      // interrupted the page.
      className="bg-bg-surface text-text-primary mt-16 mb-auto w-full max-w-3xl rounded-lg p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-4">
        <FilmSearch
          autoFocus
          label="Find a film"
          placeholder="Part of the title is enough"
          onSearch={onSearch}
          onSelect={onSelect}
          isUnavailable={isUnlinkable}
          unavailableLabel="Not on TMDB"
        />

        {error ? (
          <p role="status" className="text-text-secondary text-sm">
            {error}
          </p>
        ) : searched && empty ? (
          <p role="status" className="text-text-secondary text-sm">
            Nothing matched that.
          </p>
        ) : null}
      </div>
    </dialog>
  );
}

/** A film the app holds but TMDB has no id for cannot be navigated to. */
function isUnlinkable(film: SearchedFilm): boolean {
  return !film.tmdbId;
}

/**
 * The panel needs its own handle to `close()` after a selection, and the shell
 * needs one to `showModal()`. Both get the same element.
 */
function mergeRefs(
  own: React.RefObject<HTMLDialogElement | null>,
  external?: Ref<HTMLDialogElement>,
) {
  return (element: HTMLDialogElement | null) => {
    own.current = element;
    if (typeof external === 'function') external(element);
    else if (external) external.current = element;
  };
}
