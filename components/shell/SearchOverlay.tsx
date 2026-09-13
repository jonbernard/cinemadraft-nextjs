'use client';

import { useRouter } from 'next/navigation';
import type { Ref } from 'react';
import { useCallback, useRef, useState } from 'react';

import { findFilmsAction } from '@/actions/search/find-films';
import { FilmSearch, type SearchedFilm } from '../draft/FilmSearch';

/**
 * The top slice the design asks for (§3).
 *
 * Cut here rather than in `findFilms`: the draft console ranks against a whole
 * league's taken list and wants the longer tail, and the number nine is a
 * property of *this panel* — what fits under the chrome without the reader
 * scrolling — not of the search.
 *
 * 🔴 Ranking already put the answer first. Twenty rows is not twenty chances
 * to be right, it is nineteen rows of noise below the one the reader wanted,
 * and it is what pushed the panel off the bottom of a 900px screen.
 */
const TOP_RESULTS = 9;

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
    return result.data.slice(0, TOP_RESULTS);
  }, []);

  // 🔴 **Escape closes on the first press.** The field is `<input
  // type="search">`, whose native behaviour spends the first Escape clearing
  // the value instead of letting the `<dialog>`'s own cancel through — so for
  // anyone who had typed something, which is everyone, "Escape closes" was
  // two Escapes.
  //
  // Fixed here rather than in `FilmSearch`: the draft console and the award
  // admin use the same typeahead inline on a page, where clearing the field is
  // the right answer to Escape and there is no dialog to close. And this is
  // still D75 — it calls `close()`, the same thing the platform would have
  // done, so the focus trap, the backdrop and focus returning to the trigger
  // all stay the platform's.
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') dialog.current?.close();
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
      onKeyDown={onKeyDown}
      aria-label="Search films"
      // Top-aligned rather than centred *vertically*: the panel reads as a
      // search bar dropping out of the chrome the icon lives in, not as a
      // modal that interrupted the page.
      //
      // 🔴 `mx-auto` and the calc'd width are not decoration. Preflight zeroes
      // the UA's `dialog { margin: auto }`, so a top-aligned dialog with no
      // horizontal margin of its own pins itself to the left edge — and
      // `w-full` leaves a phone no gutter at all. The calc keeps 1rem either
      // side at 390px and `max-w-3xl` still governs from ~832px up.
      //
      // The height cap is the floor under the nine-result cut: nine rows fit
      // 844px, but a landscape phone or a short window would still push the
      // panel off-screen, and a panel that runs past the viewport is the
      // thing to prevent, not a row count.
      className="bg-bg-panel text-text-primary mx-auto mt-16 mb-auto max-h-[calc(100dvh-5rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm"
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
