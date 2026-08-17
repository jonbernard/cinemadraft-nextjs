'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';
import { cn } from '@/lib/utils/cn';

/**
 * The badge that marks a film watched.
 *
 * 🔴 **"Watched", not "watchlist"** (D64). The source's label is "Mark as
 * watched" / "Watched!", its toast reads "Marked as watched", and reviews hang
 * off the same rows — so this is a record of what you have seen, not a queue of
 * what you mean to see. Every string here says so, and none says "add to
 * watchlist".
 *
 * Four things this component does that the source's `WatchButton` did not:
 *
 * 1. **`aria-pressed` rather than an icon swap.** The source rendered a plus or
 *    a check inside the same button, so the state existed only in the glyph and
 *    a screen reader heard "button" either way. Here the button is one control
 *    whose pressed state is announced.
 *
 * 2. **The accessible name includes the film.** A browse grid holds twenty of
 *    these, and twenty identically-named buttons are indistinguishable in a
 *    screen reader's element list.
 *
 * 3. **It reverts on failure.** The source set local state and never undid it,
 *    so a refused write left a permanent check for a row that does not exist —
 *    and the badge kept claiming the film was watched until a hard reload.
 *
 * 4. **It sends the state it wants, not a toggle.** A stale badge would
 *    otherwise send the wrong request: an out-of-date check issues a delete for
 *    a row already gone, an out-of-date plus creates a second one.
 *
 * The touch target is 44px even though the visual badge is smaller — it sits in
 * a poster's corner, where the artwork is also a link, and a target that only
 * covers the glyph is a mis-tap waiting to navigate away instead.
 */
export function WatchedToggle({
  tmdbId,
  title,
  watched,
  onChange,
  className,
}: {
  tmdbId: string;
  title: string;
  watched: boolean;
  onChange: (input: {
    tmdbId: string;
    watched: boolean;
  }) => Promise<ActionResult<{ watched: boolean }>>;
  className?: string;
}) {
  const [isWatched, setIsWatched] = useState(watched);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The server's answer wins. Without this the badge would keep showing a stale
  // optimistic value after the page revalidated for another reason.
  useEffect(() => {
    setIsWatched(watched);
  }, [watched]);

  const toggle = useCallback(() => {
    const next = !isWatched;
    setIsWatched(next);
    setMessage(null);

    startTransition(async () => {
      const result = await onChange({ tmdbId, watched: next });
      if (!result.ok) {
        setIsWatched(!next);
        setMessage(result.message);
      }
    });
  }, [isWatched, onChange, tmdbId]);

  const label = isWatched
    ? `${title} — watched. Mark as not watched`
    : `Mark ${title} as watched`;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={isWatched}
        // Not `disabled` while pending: disabling moves focus off the control
        // mid-interaction, and a second press is harmless because the action
        // states an end state rather than flipping one.
        aria-busy={isPending || undefined}
        className={cn(
          'focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center focus-visible:outline-2',
          className,
        )}
      >
        {/* The glyph is decoration; the accessible name is the button's meaning.
            A filled disc behind it so the mark reads against any poster — a
            bare stroke disappears into a light or busy image. */}
        <span
          aria-hidden="true"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
            isWatched
              ? 'border-accent-fill bg-accent-fill text-bg-base'
              : 'border-border-rule bg-bg-surface/85 text-text-primary',
          )}
        >
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isWatched ? <path d="M5 13l4 4L19 7" /> : <path d="M12 5v14M5 12h14" />}
          </svg>
        </span>
        <span className="sr-only">{label}</span>
      </button>

      {/* Announced rather than shown as a tooltip: the failure needs to reach
          somebody who cannot see the badge revert. */}
      {message ? (
        <span role="status" className="sr-only">
          {message}
        </span>
      ) : null}
    </>
  );
}
