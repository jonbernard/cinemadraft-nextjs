import { cn } from '@/lib/utils/cn';
import { SectionHead } from './SectionHead';

/**
 * Structurally `ScoringLevel` from `lib/services/scoring-table.ts`,
 * re-declared because `components/` may not import a service (D33).
 */
export type ScoringGroup = {
  level: string;
  /** Ascending by tier, as the service sorts them. */
  tiers: readonly { tier: number; points: number }[];
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
    <div className={cn('flex flex-col gap-6', className)}>
      {levels.map((group) => (
        <div
          key={group.level}
          data-testid={`scoring-group-${group.level}`}
          className="flex flex-col gap-1"
        >
          <SectionHead as="h4" className="pb-1">
            {group.level}
          </SectionHead>
          <dl className="flex flex-col">
            {group.tiers.map((tier) => (
              <div
                key={tier.tier}
                className="border-border-rule flex items-baseline justify-between gap-4 border-t py-2"
              >
                <dt className="text-text-secondary text-sm">
                  {TIER_MEANING[tier.tier] ?? `Tier ${tier.tier}`}
                </dt>
                <dd className="text-text-primary tabular shrink-0 font-mono text-sm">
                  {tier.points}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
