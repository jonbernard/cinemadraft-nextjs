import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { SectionHead } from '../ui/SectionHead';
import { StatusChip } from '../ui/StatusChip';

/**
 * Structurally the `SeasonPhase` produced by `lib/services/dashboard.ts`, and
 * declared here rather than imported: that module reaches repositories and the
 * db client, and `components/` may not depend on it (D33). `SeasonStepper`
 * re-declares the same shape for the same reason.
 */
export type SeasonPhase = {
  /** `${eventId}-nominations` / `${eventId}-ceremony`, unique per phase. */
  key: string;
  eventId: number;
  phase: 'nominations' | 'ceremony';
  name: string | null;
  abbreviation: string | null;
  /** Epoch milliseconds, UTC midnight of the day. Null means unscheduled. */
  date: number | null;
  complete: boolean;
};

/** What a beat is: done and paid, the next thing to happen, or later. */
export type BeatState = 'complete' | 'next' | 'upcoming';

/**
 * 🔴 Fixed to UTC, for the reason `SeasonStepper` documents at its own
 * formatter: the dates arrive as epoch milliseconds, and a formatter following
 * the ambient zone renders one day on a UTC server and the previous day in a
 * browser west of it. That is a hydration mismatch on this page's most
 * prominent dates, and React discards the server HTML to fix it.
 */
const dayLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const AVERAGE_MONTH_MS = 30.44 * 86_400_000;

/**
 * How long the season runs, in whole months, or null when it cannot be known.
 *
 * 🔴 Computed, never stated. `docs/PLAN.md` asks this page to answer "a weekend
 * or five months"; a typed "five months" would be wrong the first time a
 * ceremony moves, on the one page whose promise is that its numbers are real.
 * Fewer than two dated phases means there is no span to report, and "0 months"
 * would be worse than silence.
 *
 * Not exported: Biome's `useComponentExportOnlyModules` forbids a non-component
 * export beside components, and it is right — the sentence this feeds is part
 * of the spine, so it renders here rather than travelling to the page as a
 * number for someone else to word.
 */
function spanMonths(phases: readonly SeasonPhase[]): number | null {
  const dates = phases.flatMap((p) => (p.date == null ? [] : [p.date]));
  if (dates.length < 2) return null;
  const months = Math.round((Math.max(...dates) - Math.min(...dates)) / AVERAGE_MONTH_MS);
  return months < 1 ? null : months;
}

/**
 * The dated spine the page hangs on (P18.T5).
 *
 * 🔴 A container, not a closed list. The page's beats are not only the season's
 * phases — draft night comes before any of them, the rulebook and the way in
 * come after — and each beat carries whatever the page wants to say at that
 * point in the season: a worked example, the shows wall, two sentences of
 * prose. So this renders the rule and whatever `SeasonBeat`s it is handed, and
 * `SeasonPhaseBeats` turns the data into beats for the ones that come from it.
 *
 * 🔴 Not `SeasonStepper`, on purpose. The stepper is a measured, client-side
 * window built to answer "what is next" for someone mid-season. This answers
 * "what happens, and in what order" for someone who has never played, which is
 * a static list — dragging a `'use client'` component, a ResizeObserver and a
 * transform onto a prose page to answer a different question is the trade this
 * avoids.
 *
 * Motion belongs to P18.T6 and is deliberately absent; every beat is its own
 * `<li>` with its own test id, so it stays individually addressable.
 */
export function SeasonShape({
  phases,
  children,
  className,
}: {
  /**
   * The season's phases — for the span sentence above the rule, and nothing
   * else. The beats themselves come from `children`, because the page's beats
   * are more than the season's phases: draft night precedes all of them and the
   * rulebook follows them. Omit it and the sentence is omitted with it.
   */
  phases?: readonly SeasonPhase[];
  children: ReactNode;
  className?: string;
}) {
  const months = phases == null ? null : spanMonths(phases);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {months == null ? null : (
        <p data-testid="season-span" className="text-text-secondary max-w-prose text-sm">
          A season runs about {months} {months === 1 ? 'month' : 'months'}, from the first
          nominations to the last ceremony.
        </p>
      )}
      {/* `pl-1` is the dot's overhang: it is 8px wide centred on the rule, so it
          reaches 4px to the left of it and would be clipped by a parent with no
          left padding of its own (measured at 390px, 2026-09-12). */}
      <ol data-testid="season-shape" className="flex flex-col pl-1">
        {children}
      </ol>
    </div>
  );
}

const DOT: Record<BeatState, string> = {
  complete: 'bg-brass-fill',
  next: 'bg-beam',
  upcoming: 'bg-border-rule',
};

/**
 * One node on the spine.
 *
 * 🔴 State is never carried by the dot alone. The dot is `aria-hidden` and
 * decorative; what a reader needs — "Paid out", "Next up" — is a chip with a
 * word in it, which is also the only form of it a screen reader or a
 * monochrome display gets. Brass is an award outcome and beam is
 * scheduled-and-not-yet (D99, D103); an upcoming beat gets neither, because a
 * chip reading "Later" on every remaining row is noise.
 *
 * `as` exists because heading level is a document-structure decision the caller
 * owns — the same reason `SectionHead` has one. A beat holding a section of its
 * own (the shows wall, the rulebook) wants its children's headings to rank
 * below this one.
 */
export function SeasonBeat({
  label,
  note,
  date,
  when,
  state = 'upcoming',
  as = 'h3',
  testId,
  className,
  children,
}: {
  label: ReactNode;
  /** The eyebrow above the label — "Nominations", "Ceremony", "Draft night". */
  note?: ReactNode;
  /** Epoch milliseconds. Null or absent falls back to `when`. */
  date?: number | null;
  /** What to print when there is no date. Absent prints nothing at all. */
  when?: ReactNode;
  state?: BeatState;
  as?: 'h2' | 'h3' | 'h4';
  testId?: string;
  className?: string;
  children?: ReactNode;
}) {
  const chip =
    state === 'complete' ? (
      <StatusChip tone="brass">Paid out</StatusChip>
    ) : state === 'next' ? (
      <StatusChip tone="beam">Next up</StatusChip>
    ) : null;

  return (
    <li
      data-testid={testId}
      className={cn(
        // The rule is the left border of every beat but the last, so it stops
        // at the final node instead of dangling past it.
        'border-border-rule relative border-l pb-8 pl-6 last:border-l-transparent last:pb-0',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute -left-1 top-1 h-2 w-2 rounded-full', DOT[state])}
      />
      <div className="flex flex-col gap-3">
        <SectionHead
          as={as}
          eyebrow={note}
          rightStacksOnMobile
          className="pb-0"
          right={
            chip || date != null || when ? (
              <span className="flex flex-wrap items-center gap-3">
                {date == null ? (
                  when ? (
                    <span className="text-text-dim font-sans text-xs">{when}</span>
                  ) : null
                ) : (
                  <time dateTime={new Date(date).toISOString().slice(0, 10)}>
                    {dayLabel.format(date)}
                  </time>
                )}
                {chip}
              </span>
            ) : undefined
          }
        >
          {label}
        </SectionHead>
        {children}
      </div>
    </li>
  );
}

function phaseLabel(phase: SeasonPhase): string {
  return phase.name ?? phase.abbreviation ?? `Show ${phase.eventId}`;
}

/**
 * The season's own phases as beats, in the order the service hands them.
 *
 * 🔴 Two beats per show, not one. Nominations and the ceremony are separate
 * scoring moments weeks apart (D81), and each pays the category's points — the
 * whole argument the spine exists to make. "Academy Awards" twice in a list
 * with no distinguishing word is the defect the old rail had, so the phase is
 * named in words above every label.
 *
 * 🔴 "Next" is the earliest incomplete phase that has a date, falling back to
 * the earliest incomplete one when nothing ahead is scheduled — `SeasonStepper`
 * picks the same phase the same way. It is read from the data rather than from
 * the clock on purpose: a server component that branched on `Date.now()` would
 * render differently on either side of a ceremony with nothing marking the
 * change, and would be untestable without freezing time.
 */
export function SeasonPhaseBeats({
  phases,
  slots,
  beatAs,
}: {
  phases: readonly SeasonPhase[];
  /** Extra content for a given phase, keyed by `SeasonPhase.key`. */
  slots?: Record<string, ReactNode>;
  beatAs?: 'h2' | 'h3' | 'h4';
}) {
  if (phases.length === 0) {
    return (
      <SeasonBeat
        testId="season-beat-empty"
        as={beatAs}
        label="No shows scheduled yet"
        when="Dates to be announced"
      >
        <p className="text-text-secondary max-w-prose text-sm">
          Each show&rsquo;s nomination and ceremony dates appear here as they are
          announced.
        </p>
      </SeasonBeat>
    );
  }

  const next =
    phases.find((p) => !p.complete && p.date != null) ?? phases.find((p) => !p.complete);

  return (
    <>
      {phases.map((phase) => (
        <SeasonBeat
          key={phase.key}
          testId={`season-beat-${phase.key}`}
          as={beatAs}
          label={phaseLabel(phase)}
          note={phase.phase === 'nominations' ? 'Nominations' : 'Ceremony'}
          date={phase.date}
          when="Date to be announced"
          state={
            phase.complete ? 'complete' : phase.key === next?.key ? 'next' : 'upcoming'
          }
        >
          {slots?.[phase.key]}
        </SeasonBeat>
      ))}
    </>
  );
}
