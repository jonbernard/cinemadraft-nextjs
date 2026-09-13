'use client';

import { useEffect, useRef, useState } from 'react';

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

/** `w-40` and the `gap-3` between boxes, in the units the class names use. */
const BOX_REM = 10;
const GAP_REM = 0.75;

/** One box plus the gap that precedes it, for the window's transform. */
const BOX_ADVANCE = `calc(${BOX_REM}rem + ${GAP_REM}rem)`;

/**
 * How many boxes the window shows before it has been measured.
 *
 * Server render and the first client render have no layout to read, and this
 * is the count a laptop turns out to have; a phone corrects it one frame later.
 */
const VISIBLE_FALLBACK = 5;

/**
 * How many whole boxes fit `width` px.
 *
 * `n` boxes occupy `n` advances minus the gap the first one does not have, so
 * the gap is added back before dividing. Never less than one: a window too
 * narrow for a single box still has to be able to move through the season.
 */
function boxesIn(width: number, rem: number): number {
  return Math.max(1, Math.floor((width + GAP_REM * rem) / ((BOX_REM + GAP_REM) * rem)));
}

/**
 * The root font size in px, because the box is sized in rem.
 *
 * 🔴 Not hardcoded to 16. A reader who has turned their browser's text size up
 * gets wider boxes, so fewer of them fit — and a count computed from the wrong
 * rem is an overcount, which is exactly the failure this whole measurement
 * exists to prevent.
 */
function rootRem(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

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
 * matter — the ones at the end. The window opens anchored to the **next**
 * show for that reason: the reader wants the next thing to happen, not
 * January. (P17.T3 — D81 anchored to the end of the array because the end
 * *was* the next thing; a season whose middle show is still open is the case
 * where those two part company.)
 *
 * 🔴 **The window is measured, and a press moves exactly one window.** Both
 * halves of that are the same bug. The window used to be a constant five boxes
 * stepping three; at 390px the clip is 366px, which holds *two* 160px boxes —
 * so the rail believed it was showing five boxes it had no room for, announced
 * five through `aria-live`, and stepping three at a time walked past boxes 3,
 * 19, 22, 23 and 24 at every offset. The last three shows of the season, the
 * ones the end-anchor exists for, could not be reached at all. Fixing only the
 * count leaves a step wider than the window and the same skip; fixing only the
 * step leaves the announcement lying about what is on screen. So the count
 * comes from the measured container and the step *is* the count, which makes
 * consecutive windows abut and skipping arithmetically impossible.
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
  const windowRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(VISIBLE_FALLBACK);
  /**
   * The offset the reader asked for, or `null` for "wherever the end is".
   *
   * 🔴 Null rather than a number, so the opening position survives
   * measurement. The window is sized after the first paint, which moves the
   * end of the season — a numeric initial offset would be the end of a
   * five-box window on a phone that turns out to hold two, i.e. anchored three
   * boxes short of the last show, which is the one thing the end-anchor exists
   * to put on screen (D81). It also keeps the anchor across a rotation, until
   * a press makes the position the reader's rather than ours.
   */
  const [requested, setRequested] = useState<number | null>(null);

  useEffect(() => {
    const element = windowRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      // `contentRect`, not the border box: the window carries `px-1` so that a
      // focused box's outline is not clipped, and those 8px hold no box.
      const width = entry?.contentRect.width ?? 0;
      // Zero means "not laid out" — a hidden ancestor, or jsdom, which has no
      // layout at all. Neither is a measurement, and believing it would
      // collapse the window to one box for reasons nothing on screen explains.
      if (width > 0) setVisible(boxesIn(width, rootRem()));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A season with no shows is a real state (a year seeded before its calendar
  // is published). The dashboard owns empty-state copy, so the stepper says
  // nothing rather than rendering an empty frame that reads as a failed load.
  if (phases.length === 0) return null;

  const now = Date.now();

  /**
   * The moment the league is waiting for.
   *
   * The earliest incomplete phase **that has a date** is the answer whenever
   * there is one: an undated phase has no date to be next *by*, and promoting
   * one would push the real next moment off the highlight.
   *
   * 🔴 The fallback is what makes this true of live data. A real season's
   * remaining phases are routinely all unscheduled — the ceremony calendar is
   * published months after the season opens — and the rail then highlighted
   * *nothing*: no `aria-current`, no chip, no countdown, on the dashboard's
   * most prominent widget. Every test was green, because they all gave every
   * box a date.
   *
   * 🔴 `findLast`, not `find`. `lib/services/dashboard.ts` sorts undated
   * phases to the end with `POSITIVE_INFINITY` and nothing orders them among
   * themselves, so "the first undated phase" is whichever row the database
   * happened to return — an unstable highlight that could move between
   * renders. The last is a fixed position, and it is where D81's end-anchor
   * already points, so the highlight and the opening window agree.
   */
  const next =
    phases.find((phase) => !phase.complete && phase.date != null) ??
    phases.findLast((phase) => !phase.complete);

  const maxOffset = Math.max(0, phases.length - visible);

  /**
   * Where the window opens.
   *
   * 🔴 Anchored to `next`, not to the end of the array (amending D81's
   * mechanism, not its intent — D81 chose the end because the end *was* the
   * next thing). A season whose last two shows are finished and whose middle
   * show is still open would otherwise open on two completed boxes.
   *
   * `next` sits at the window's left edge so what follows it is on screen
   * too; clamped to `maxOffset` so the last window is never short.
   *
   * `requested === null` still carries "wherever the anchor is", and still for
   * the reason D81 records: the window is measured after first paint, so a
   * numeric initial offset would be computed against a box count that turns
   * out to be wrong. That survives here — the anchor is recomputed on the
   * render that follows the measurement.
   */
  const nextIndex =
    next == null ? -1 : phases.findIndex((phase) => phase.key === next.key);
  const anchor = nextIndex < 0 ? maxOffset : Math.min(nextIndex, maxOffset);
  const offset = requested === null ? anchor : Math.min(requested, maxOffset);

  const first = Math.min(offset + 1, phases.length);
  const last = Math.min(offset + visible, phases.length);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        ref={windowRef}
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
                className="bg-bg-surface flex w-40 shrink-0 flex-col gap-2 rounded-sm p-3"
              >
                <StatusChip
                  // 🔴 P17.T20 (a later tranche) spends the `beam` token here
                  // and on the live surface. Carmine until then — do not
                  // "tidy" this to neutral in the meantime, or T20 will have
                  // nothing to change and the token will stay unspent.
                  tone={isNext ? 'carmine' : 'neutral'}
                  // The card is already `raised`, so a neutral chip steps down
                  // rather than up; `self-start` keeps it a badge rather than a
                  // stretched banner in the flex column.
                  className={cn('self-start', !isNext && 'bg-bg-panel')}
                >
                  {phase.complete
                    ? 'Complete'
                    : isNext
                      ? // An unscheduled next show is a real and common state:
                        // the ceremony calendar is published months into the
                        // season. Saying so in the chip means the box carries
                        // its status and its date in one line instead of
                        // leaving a reader to pair "Next" with a "Date TBA"
                        // three lines down.
                        phase.date == null
                        ? 'Next · date TBA'
                        : 'Next'
                      : 'Upcoming'}
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
                  // Suppressed on the next box, where the chip above already
                  // said it. Unscheduled phases still belong on the rail: they
                  // are real moments on the season's ballot, and omitting them
                  // makes the season look shorter than it is.
                  isNext ? null : (
                    <span className="text-text-dim text-xs">Date TBA</span>
                  )
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
            onClick={() => setRequested(Math.max(0, offset - visible))}
            disabled={offset === 0}
            aria-label="Earlier in the season"
            className="bg-bg-surface text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex h-11 min-w-11 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 disabled:opacity-40"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => setRequested(Math.min(maxOffset, offset + visible))}
            disabled={offset === maxOffset}
            aria-label="Later in the season"
            className="bg-bg-surface text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex h-11 min-w-11 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 disabled:opacity-40"
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
