'use client';

import Tooltip from '@mui/material/Tooltip';
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
 *
 * ---
 *
 * 🔴 **Everything above is about a screen reader, and that was the defect.**
 * The glyph is `aria-hidden` decoration, so the meaning lived entirely in the
 * accessible name: a *sighted* reader got a bare mark on all four call sites
 * and had to press it to find out. A component can be thorough for assistive
 * tech and still say nothing to the eye. Two changes:
 *
 * 🔴 **`hint` has no default, deliberately.** It is the one prop a call site
 * cannot forget, because forgetting it is exactly the bug being fixed — a bare
 * glyph nobody can read. `'label'` puts the action in words beside the mark and
 * is the answer wherever there is room; `'tooltip'` is for the places there is
 * not, which today is a poster's corner in `BrowseMonth`. Never both: two
 * mechanisms saying the same thing on one control is clutter.
 *
 * 🔴 **MUI's `Tooltip`, not the native `title` attribute** (AGENTS.md: MUI for
 * components, Tailwind for custom styling). `title` looks like the lazy answer
 * and is the wrong one here: it never opens on touch, and a phone is precisely
 * where a hover-only hint leaves the reader with the bare glyph again. MUI's
 * opens on long-press (`enterTouchDelay`). It also lives *inside* this
 * component rather than at the call site so that its words are the same
 * `label` the button announces, and change with `isWatched` in the same render
 * — a tooltip composed outside would keep saying "Mark as watched" until the
 * server revalidated.
 *
 * 🔴 **An eye, not a plus** (D64). A `+` reads as "add to a list of films to
 * watch later", the exact opposite of what a row means here — the note at the
 * top insists every string says "watched" and none says "add to watchlist", and
 * the icon was contradicting all of them. An eye says "seen". The check on the
 * filled disc already said "done", so it stays.
 *
 * 🔴 **The visible word leads the accessible name** (WCAG 2.5.3, Label in
 * Name): "Mark Sinners as watched" does not *contain* the visible "Mark as
 * watched", so a voice-control user saying the words in front of them would
 * have missed this button. Hence "Mark as watched: Sinners", and hence
 * `aria-label` rather than the `sr-only` span it replaces — the name is now one
 * string rather than two nodes a name computation may or may not join with a
 * space.
 */
export function WatchedToggle({
  tmdbId,
  title,
  watched,
  onChange,
  hint,
  className,
}: {
  tmdbId: string;
  title: string;
  watched: boolean;
  onChange: (input: {
    tmdbId: string;
    watched: boolean;
  }) => Promise<ActionResult<{ watched: boolean }>>;
  /**
   * How a sighted reader is told what the button does. Required: a call site
   * that omitted it would ship the bare glyph this prop exists to abolish.
   */
  hint: 'label' | 'tooltip';
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

  // The word the eye reads, and the sentence the ear hears — the first is a
  // prefix of the second, which is the whole point (WCAG 2.5.3 above).
  const action = isWatched ? 'Watched' : 'Mark as watched';
  const label = isWatched
    ? `Watched: ${title}. Mark as not watched`
    : `Mark as watched: ${title}`;

  const button = (
    <button
      type="button"
      onClick={toggle}
      // 🔴 One name, from one string. `aria-label` rather than the `sr-only`
      // span it replaces: the visible label has to be a *substring* of the
      // accessible name, and two sibling nodes are joined by a name
      // computation that may or may not put a space between them. It also
      // survives `BrowseMonth` wrapping this in a MUI `Tooltip`, which would
      // otherwise set an `aria-label` of its own — the child's wins, and the
      // two strings are identical anyway.
      aria-label={label}
      // 🔴 The test's handle. Not the accessible name: that name *changes* when
      // the film is marked, by design, so a name-based locator resolves to a
      // different element after the click — which is how a correct feature came
      // to look broken. Stripped from production output by `next.config.ts`.
      data-testid={`watched-toggle-${tmdbId}`}
      aria-pressed={isWatched}
      // Not `disabled` while pending: disabling moves focus off the control
      // mid-interaction, and a second press is harmless because the action
      // states an end state rather than flipping one.
      aria-busy={isPending || undefined}
      className={cn(
        'focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center gap-2 focus-visible:outline-2',
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
            ? 'border-accent-fill bg-accent-fill text-bg-ground'
            : 'border-border-rule bg-bg-panel/85 text-text-primary',
        )}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isWatched ? (
            <path d="M5 13l4 4L19 7" />
          ) : (
            <>
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </span>

      {/* `aria-hidden` is wrong here and deliberately absent: this text is
            part of the name, and hiding it would leave a visible word the
            accessible name no longer matches. It is a prefix of `aria-label`,
            which is what makes the two agree. */}
      {hint === 'label' ? (
        <span className="text-text-secondary pr-1 text-xs whitespace-nowrap">
          {action}
        </span>
      ) : null}
    </button>
  );

  return (
    <>
      {/* 🔴 The raw `<button>` is the child, not a wrapping `<span>`. MUI clones
          its child with a ref and its own pointer and focus handlers, and a
          function component that forwards neither would get a tooltip that
          never opens — the usual `<span>` workaround would work, but it would
          also put MUI's `aria-label` on a wrapper element instead of on the
          control. The element here takes both directly, and the explicit
          `aria-label` above still wins because a cloned child's own props do.

          No `describeChild`: that mode adds a native `title` attribute and an
          `aria-describedby`, which is a second string for one control. The
          default is name-only, and MUI's string is this same `label`. */}
      {hint === 'tooltip' ? <Tooltip title={label}>{button}</Tooltip> : button}

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
