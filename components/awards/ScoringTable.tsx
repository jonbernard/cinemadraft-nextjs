import Link from 'next/link';

import { cn } from '@/lib/utils/cn';
import { SectionHead } from '../ui/SectionHead';
import { ShowLogo } from './ShowLogo';

/**
 * Structurally `ScoringLevel` from `lib/services/scoring-table.ts`,
 * re-declared because `components/` may not import a service (D33).
 */
export type ScoringGroup = {
  level: string;
  /** Ascending by tier, as the service sorts them. */
  tiers: readonly { tier: number; points: number }[];
  /**
   * The shows that pay at this level, if the caller has them.
   *
   * 🔴 The marks live here rather than in a section of their own, which is
   * where they started. A wall of twelve logos teaches the vocabulary and
   * then the values repeated the same four groups immediately below it — two
   * passes over one idea. Beside its own figures, a mark answers the question
   * a reader actually has: *that show, this much.*
   */
  shows?: readonly {
    eventId: number;
    name: string | null;
    abbreviation: string | null;
    imageUrl: string | null;
  }[];
};

/**
 * What each tier actually is (docs/PLAN.md § Phase 18, "the three tiers and
 * what each means" — content that must survive the rewrite).
 *
 * 🔴 The *label* is copy and lives here; the *value* beside it comes from the
 * `points` table. A tier with no label still renders, because the table is
 * editable and a category band that appeared in the database but not on this
 * page would be invisible to the only readers who need it.
 */
const TIER_MEANING: Record<number, string> = {
  1: 'Best Picture',
  2: 'Acting, writing and directing',
  3: 'Every other televised category',
};

/**
 * 🔴 The same tiers, named for a show that hands out the opposite prize.
 * Rendered against the restored data the generic labels printed **"Best
 * Picture — −20"** under the Razzies, which is not a category anybody is
 * nominated for and reads as a scoring error rather than as a joke.
 *
 * Keyed off the values, never off the level's name: a level whose tiers are
 * negative is a penalty level whatever it is called, and matching on the
 * string "Razzies" would break the day somebody adds a second one.
 */
const PENALTY_TIER_MEANING: Record<number, string> = {
  1: 'Worst Picture',
  2: 'Worst acting, writing and directing',
  3: 'Every other Razzie category',
};

/**
 * The scoring rulebook, grouped by show (P18.T3).
 *
 * 🔴 A definition list, not a grid. The old three-column table put the tier
 * meanings in a bullet list three paragraphs above the numbers, so a reader had
 * to hold "tier 2 means acting" in their head while scanning bare cells — and
 * at 390px the grid scrolled horizontally, taking the show's name away from its
 * own figures. Term and description reflow to one column for free.
 *
 * 🔴 This lands late on the page, after the argument has been made, so it is
 * deliberately quiet: no panel of its own, no chips, no colour. It is the
 * reference a reader scrolls back to, and it must not compete with the beats
 * above it.
 *
 * Level order is the service's (descending by the level's highest value) and is
 * carried through untouched: the most valuable show reads first, which is the
 * order a new reader wants.
 *
 * `h4` because the page nests this two levels down — section `h2`, panel `h3`,
 * show `h4`. `SectionHead` owns the 28/20/17 ramp; writing that size as a
 * local arbitrary class here would fork the scale, and `scripts/layering.sh`
 * fails the build on it (the grep reads comments too, which is why this one
 * spells the class out in words).
 */
export function ScoringTable({
  levels,
  className,
}: {
  levels: readonly ScoringGroup[];
  className?: string;
}) {
  if (levels.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-2 gap-6', className)}>
      {levels.map((group) => {
        const penalty = group.tiers.every((tier) => tier.points < 0);
        const meaning = penalty ? PENALTY_TIER_MEANING : TIER_MEANING;
        // 🔴 A level with one or two shows sets its marks beside its figures
        // rather than above them. Stacked, a single 64px mark left most of the
        // row empty and the group read as unfinished next to the nine-mark one
        // below it. From three marks up, stacking is what fits.
        const asideMarks = (group.shows?.length ?? 0) <= 2;
        return (
          <div
            key={group.level}
            data-testid={`scoring-group-${group.level}`}
            className={cn(
              'flex flex-col gap-4',
              ['Oscars', 'Golden Globes'].includes(group.level)
                ? 'col-span-1'
                : 'col-span-2',
            )}
          >
            <SectionHead as="h4" className="pb-1">
              {group.level}
            </SectionHead>

            <div
              className={cn(
                asideMarks && 'sm:grid sm:grid-cols-[auto_1fr] sm:items-start sm:gap-8',
              )}
            >
              {group.shows && group.shows.length > 0 ? (
                <ul
                  className={cn(
                    'flex flex-wrap items-center gap-2 pb-2',
                    asideMarks && 'sm:pb-0',
                  )}
                >
                  {group.shows.map((show) => (
                    <li key={show.eventId}>
                      {show.abbreviation ? (
                        <Link
                          href={`/award-shows/${show.abbreviation}`}
                          title={show.name ?? show.abbreviation}
                          className="focus-visible:outline-accent-fill block rounded-sm focus-visible:outline-2"
                        >
                          <ShowLogo imageUrl={show.imageUrl} />
                          <span className="sr-only">
                            {show.name ?? show.abbreviation}
                          </span>
                        </Link>
                      ) : (
                        <ShowLogo imageUrl={show.imageUrl} />
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <dl className="flex flex-col">
                {group.tiers.map((tier) => (
                  <div
                    key={tier.tier}
                    className="border-border-rule flex items-baseline justify-between gap-4 border-t py-2"
                  >
                    <dt className="text-text-secondary text-sm">
                      {meaning[tier.tier] ?? `Tier ${tier.tier}`}
                    </dt>
                    <dd className="text-text-primary tabular shrink-0 font-mono text-sm">
                      {tier.points}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        );
      })}
    </div>
  );
}
