'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { StatusChip } from './StatusChip';

/**
 * Structurally the `SeasonPhase` produced by `lib/services/dashboard.ts`, and
 * declared here rather than imported: that module reaches repositories and the
 * db client, and `components/` may not depend on it (D33). A type-only import
 * would erase at build time but still points the dependency the wrong way.
 */
export type SeasonPhase = {
  /** `${eventId}-nominations` / `${eventId}-ceremony`, unique per box. */
  key: string;
  eventId: number;
  phase: 'nominations' | 'ceremony';
  name: string | null;
  abbreviation: string | null;
  /**
   * Epoch milliseconds, not a `Date` — this is the shape the events repository
   * normalizes its bigint schedule columns to, and a `Date` would not survive
   * the RSC boundary without serialization. `null` means the phase exists but
   * has not been scheduled yet.
   */
  date: number | null;
  complete: boolean;
};

const DAY_MS = 86_400_000;

/** How many boxes fit the window, and how many a press moves. */
const VISIBLE = 5;
/** Three is a phone's worth and half a laptop's. */
const STEP = 3;

/** `w-40` plus the `gap-3` between boxes, in the same units the class names use. */
const BOX_ADVANCE = 'calc(10rem + 0.75rem)';

/**
 * Fixed to UTC deliberately. The dates come off the wire as epoch
 * milliseconds, so a formatter that follows the ambient zone renders one day
 * on a server in UTC and the previous day in a browser west of it — that is a
 * hydration mismatch on the dashboard's most prominent date, and React will
 * discard the server HTML to fix it. One zone for both sides means the
 * stepper says the same thing everywhere. (Award shows are announced by date,
 * not by the viewer's local clock, so this loses nothing.)
 */
const showDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * Whole days until a phase, or `null` if it is not in the future.
 *
 * Returning `null` rather than a number is the whole point: the "next" phase
 * is the earliest incomplete one, and a phase whose date has passed while
 * nobody marked it complete is still the next one. Subtracting in that state
 * yields a negative count, and "in -12 days" is the kind of defect that makes
 * the whole dashboard look untrustworthy.
 */
function daysUntil(date: number, now: number): number | null {
  const remaining = date - now;
  if (remaining <= 0) return null;
  return Math.ceil(remaining / DAY_MS);
}

function label(phase: SeasonPhase): string {
  return phase.name ?? phase.abbreviation ?? `Show ${phase.eventId}`;
}

/**
 * Steps toward the start of the season, clamping the last short hop to zero.
 *
 * Landing on offset 1 or 2 would leave a sliver of the first box hanging off
 * the left edge for one press only, which reads as a rendering bug rather than
 * as a position in the season.
 */
function earlier(offset: number): number {
  const next = offset - STEP;
  return next < STEP ? 0 : next;
}

function later(offset: number, max: number): number {
  const next = offset + STEP;
  return next > max - STEP ? max : next;
}

/**
 * The season's award shows as a stepped rail — one box per **show phase**
 * (§6.7, D81).
 *
 * 🔴 **Two boxes per show, not one.** Nominations and the ceremony are
 * separate scoring moments weeks apart, and the rail that showed only
 * `awards_date` hid the date half the league is actually waiting for.
 *
 * 🔴 **A window, not a horizontal scroll.** A full season is two dozen boxes.
 * The previous rail scrolled sideways inside its own container, which on a
 * trackpad fights the page's own scrolling and on a phone hides the boxes that
 * matter — the ones at the end. The window opens anchored to the end for that
 * reason: the reader wants the next thing to happen, not January.
 *
 * Every phase stays in the DOM in date order; the window is a transform. A
 * screen reader gets the whole season, and so does a reader whose JavaScript
 * never arrives.
 *
 * **The countdown is a static day-granularity string, not a ticking clock.**
 * Buying seconds of precision for a date months away is not worth the render
 * churn; the absolute date rides along in a `<time datetime>` so that if the
 * relative string drifts across a midnight, the authoritative date is still on
 * screen next to it.
 *
 * Status is never carried by colour alone: "complete" and "next" are also
 * words in the markup, so the rail survives a monochrome print, a colour-blind
 * reader and a screen reader (§6.4 a11y, colour-not-only).
 */
export function SeasonStepper({
  phases,
  className,
}: {
  phases: SeasonPhase[];
  className?: string;
}) {
  const maxOffset = Math.max(0, phases.length - VISIBLE);
  const [offset, setOffset] = useState(maxOffset);

  // A season with no shows is a real state (a year seeded before its calendar
  // is published). The dashboard owns empty-state copy, so the stepper says
  // nothing rather than rendering an empty frame that reads as a failed load.
  if (phases.length === 0) return null;

  const now = Date.now();

  // The earliest incomplete phase that has a date. An undated phase can never
  // be next — it has no date to be next *by*, and promoting it would push the
  // real next moment off the highlight.
  const next = phases.find((phase) => !phase.complete && phase.date != null);

  const first = Math.min(offset + 1, phases.length);
  const last = Math.min(offset + VISIBLE, phases.length);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        data-testid="season-window"
        data-offset={offset}
        className="-mx-1 overflow-hidden px-1"
      >
        <ol
          aria-label="Season award shows"
          className="flex min-w-max items-stretch gap-3 transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(calc(${offset} * ${BOX_ADVANCE} * -1))` }}
        >
          {phases.map((phase) => {
            const isNext = phase.key === next?.key;
            const countdown =
              isNext && phase.date != null ? daysUntil(phase.date, now) : null;

            return (
              <li
                key={phase.key}
                // `step` rather than `date`: the rail is a sequence the season
                // moves through, and assistive tech should land on the moment
                // the league is actually waiting for.
                aria-current={isNext ? 'step' : undefined}
                className="bg-bg-raised flex w-40 shrink-0 flex-col gap-2 rounded-md p-3"
              >
                <StatusChip
                  tone={isNext ? 'carmine' : 'neutral'}
                  // The card is already `raised`, so a neutral chip steps down
                  // rather than up; `self-start` keeps it a badge rather than a
                  // stretched banner in the flex column.
                  className={cn('self-start', !isNext && 'bg-bg-surface')}
                >
                  {phase.complete ? 'Complete' : isNext ? 'Next' : 'Upcoming'}
                </StatusChip>

                <span
                  className={cn(
                    'font-serif text-base leading-tight',
                    phase.complete ? 'text-text-secondary' : 'text-text-primary',
                  )}
                >
                  {label(phase)}
                </span>

                {/* Which half of the show this is. Without it a season reads as
                    every show listed twice. */}
                <span className="text-text-dim text-xs">
                  {phase.phase === 'nominations' ? 'Nominations' : 'Ceremony'}
                </span>

                {phase.date == null ? (
                  // Unscheduled phases still belong on the rail: they are real
                  // moments on the season's ballot, and omitting them makes the
                  // season look shorter than it is.
                  <span className="text-text-dim text-xs">Date TBA</span>
                ) : (
                  <time
                    dateTime={new Date(phase.date).toISOString()}
                    className="text-text-secondary tabular font-mono text-xs"
                  >
                    {showDate.format(phase.date)}
                  </time>
                )}

                {countdown != null && (
                  <span className="text-accent-text tabular text-xs font-semibold">
                    {countdown === 1 ? 'in 1 day' : `in ${countdown} days`}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {maxOffset > 0 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset(earlier)}
            disabled={offset === 0}
            aria-label="Earlier in the season"
            className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex h-11 min-w-11 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 disabled:opacity-40"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => setOffset((current) => later(current, maxOffset))}
            disabled={offset === maxOffset}
            aria-label="Later in the season"
            className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex h-11 min-w-11 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 disabled:opacity-40"
          >
            <span aria-hidden="true">›</span>
          </button>
          {/* Position in the season, for a reader who cannot see the window
              move. Polite: it must not interrupt whatever is being read. */}
          <p aria-live="polite" className="text-text-dim tabular font-mono text-xs">
            Showing shows {first} to {last} of {phases.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}
