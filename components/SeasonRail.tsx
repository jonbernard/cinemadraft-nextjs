import { cn } from '@/lib/utils/cn';
import { StatusChip } from './StatusChip';

/**
 * Structurally the `SeasonEvent` produced by `lib/services/dashboard.ts`, and
 * declared here rather than imported: that module reaches repositories and the
 * db client, and `components/` may not depend on it (D33). A type-only import
 * would erase at build time but still points the dependency the wrong way.
 */
export type SeasonEvent = {
  id: number;
  name: string | null;
  abbreviation: string | null;
  /**
   * Epoch milliseconds, not a `Date` — this is the shape the events repository
   * normalizes its bigint schedule columns to, and a `Date` would not survive
   * the RSC boundary without serialization. `null` means the show exists but
   * has not been scheduled yet.
   */
  date: number | null;
  complete: boolean;
};

const DAY_MS = 86_400_000;

/**
 * Fixed to UTC deliberately. The dates come off the wire as epoch
 * milliseconds, so a formatter that follows the ambient zone renders one day
 * on a server in UTC and the previous day in a browser west of it — that is a
 * hydration mismatch on the dashboard's most prominent date, and React will
 * discard the server HTML to fix it. One zone for both sides means the rail
 * says the same thing everywhere. (Award shows are announced by date, not by
 * the viewer's local clock, so this loses nothing.)
 */
const showDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * Whole days until a show, or `null` if it is not in the future.
 *
 * Returning `null` rather than a number is the whole point: the "next" show is
 * the earliest incomplete one, and a show whose date has passed while nobody
 * marked it complete is still the next show. Subtracting in that state yields
 * a negative count, and "in -12 days" is the kind of defect that makes the
 * whole dashboard look untrustworthy.
 */
function daysUntil(date: number, now: number): number | null {
  const remaining = date - now;
  if (remaining <= 0) return null;
  return Math.ceil(remaining / DAY_MS);
}

/**
 * Ordered for reading, not as the caller happened to fetch them.
 *
 * The rail reads left-to-right as time, so a caller-ordered rail with March
 * before January reads as a bug even when the data is correct. Undated shows
 * sort last because they have no position on a timeline; among themselves they
 * keep the caller's order, which is the only meaningful order they have.
 */
function forReading(events: readonly SeasonEvent[]): SeasonEvent[] {
  return [...events].sort((a, b) => {
    if (a.date == null && b.date == null) return 0;
    if (a.date == null) return 1;
    if (b.date == null) return -1;
    return a.date - b.date;
  });
}

function label(event: SeasonEvent): string {
  return event.name ?? event.abbreviation ?? `Show ${event.id}`;
}

/**
 * The season's award shows as one horizontal rail (§6.7).
 *
 * This information already exists in the app but is buried inside a single
 * event's detail card, so answering "what is next, and when" currently means
 * navigating away from the dashboard and back.
 *
 * **The countdown is a static day-granularity string, not a ticking clock.**
 * Rendered in a Server Component, any countdown is stale the instant the HTML
 * ships; the honest options are a coarse unit that stays true for hours, or a
 * client component that recomputes. This picks the coarse unit, because a
 * live-ticking "4d 06:12:59" is the only part of this rail that would need
 * JavaScript, and buying seconds of precision for a date months away is not
 * worth shipping a hydration boundary onto the dashboard's critical path. The
 * absolute date rides along in a `<time datetime>` for exactly this reason: if
 * the cached page outlives a midnight and the relative string drifts by a day,
 * the authoritative date is still on screen next to it.
 *
 * Status is never carried by colour alone: "complete" and "next" are also
 * words in the markup, so the rail survives a monochrome print, a colour-blind
 * reader and a screen reader (§6.4 a11y, colour-not-only).
 */
export function SeasonRail({
  events,
  className,
}: {
  events: SeasonEvent[];
  className?: string;
}) {
  // A season with no shows is a real state (a year seeded before its calendar
  // is published). The dashboard owns empty-state copy, so the rail says
  // nothing rather than rendering an empty frame that reads as a failed load.
  if (events.length === 0) return null;

  const ordered = forReading(events);
  const now = Date.now();

  // The earliest incomplete show that has a date. An undated show can never be
  // next — it has no date to be next *by*, and promoting it would push the
  // real next show off the highlight.
  const next = ordered.find((event) => !event.complete && event.date != null);

  return (
    // Horizontal scroll rather than wrapping or shrinking: a twelve-show season
    // on a 375px phone has to stay readable, and both alternatives trade
    // legibility for fitting everything on screen at once.
    <div className={cn('-mx-1 overflow-x-auto px-1', className)}>
      <ol aria-label="Season award shows" className="flex min-w-max items-stretch gap-3">
        {ordered.map((event) => {
          const isNext = event.id === next?.id;
          const countdown =
            isNext && event.date != null ? daysUntil(event.date, now) : null;

          return (
            <li
              key={event.id}
              // `step` rather than `date`: the rail is a sequence the season
              // moves through, and assistive tech should land on the show the
              // league is actually waiting for.
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
                {event.complete ? 'Complete' : isNext ? 'Next' : 'Upcoming'}
              </StatusChip>

              <span
                className={cn(
                  'font-serif text-base leading-tight',
                  event.complete ? 'text-text-secondary' : 'text-text-primary',
                )}
              >
                {label(event)}
              </span>

              {event.date == null ? (
                // Undated shows still belong on the rail: they are real shows
                // on the season's ballot, and omitting them makes the season
                // look shorter than it is.
                <span className="text-text-dim text-xs">Date TBA</span>
              ) : (
                <time
                  dateTime={new Date(event.date).toISOString()}
                  className="text-text-secondary tabular font-mono text-xs"
                >
                  {showDate.format(event.date)}
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
  );
}
