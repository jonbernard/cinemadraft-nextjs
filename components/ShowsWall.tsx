import Link from 'next/link';

import { cn } from '@/lib/utils/cn';
import { Eyebrow } from './Eyebrow';
import { Panel } from './Panel';
import { SectionHead } from './SectionHead';
import { ShowLogo } from './ShowLogo';
import { StatusChip } from './StatusChip';

/**
 * A subset of `AwardShowSummary` from `lib/services/award-show.ts`, re-declared
 * because `components/` may not import a service (D33). `categoryCount` and the
 * two `needs*` flags are deliberately absent: this page teaches names, and an
 * admin's to-do count is noise at that job.
 */
export type ShowsWallShow = {
  eventId: number;
  name: string | null;
  abbreviation: string | null;
  /** The show's mark, a Blob URL. Null shows render their name alone. */
  imageUrl: string | null;
};

/**
 * One scoring level and the shows that score at it.
 *
 * 🔴 The caller does the join. `points.level` is not a column on `events`, and
 * there is no cheap join between a show and its scoring level (the plan flags
 * this as under-specified rather than guessing). What this component will not
 * do is key its copy off the level's *name* — "Alphabet is flat" typed into a
 * component is exactly the sort of figure this page exists not to contain.
 */
export type ShowsWallGroup = {
  /** The `points.level` value, printed verbatim so this and `ScoringTable` agree. */
  level: string;
  /** That level's rows, as `groupPointsByLevel` returns them. */
  tiers: readonly { tier: number; points: number }[];
  shows: readonly ShowsWallShow[];
};

type Scoring = { chip: string; sentence: string };

/**
 * What kind of level this is, read off its own point values.
 *
 * 🔴 Derived, never typed. All three facts the section has to teach — that the
 * nine Alphabet bodies score flat, that the Globes and the Oscars are tiered,
 * and that the Razzies take points off — are visible in the numbers, so they
 * are computed from them. A level that changed shape in the database would
 * change its own caption here.
 *
 * 🔴 The negative case is carried by a word and a minus glyph, not by colour.
 * Colour is never the only carrier of state, and this is the one distinction on
 * the page a reader cannot afford to miss.
 */
function scoringOf(tiers: readonly { points: number }[]): Scoring | null {
  if (tiers.length === 0) return null;
  if (tiers.every((t) => t.points < 0)) {
    return {
      chip: '− Costs points',
      sentence: 'A nomination here takes points off your total.',
    };
  }
  if (tiers.every((t) => t.points === tiers[0].points)) {
    return {
      chip: 'Flat',
      sentence: 'Every category is worth the same — the tiers do not apply.',
    };
  }
  return { chip: 'Tiered', sentence: 'A bigger category is worth more.' };
}

function showName(show: ShowsWallShow): string {
  return show.name ?? show.abbreviation ?? `Show ${show.eventId}`;
}

/**
 * The shows that score, grouped by what they pay (P18.T4).
 *
 * This is the page that teaches the vocabulary the leaderboard assumes: a
 * reader meets "ACE" and "ASC" as column headings on the dashboard, so here the
 * full name leads and the abbreviation is the subordinate label — the same
 * lockup `/award-shows` uses, so the two pages teach the same thing the same
 * way.
 *
 * 🔴 Marks at `ShowLogo`'s 64px `sm` on its white plate (P17.T12). At the old
 * 40px the wordmarks were unreadable, so the page whose job is to teach twelve
 * award bodies taught nothing.
 *
 * 🔴 No `?year=` on the href, unlike `/award-shows`'s cards: this page is not
 * scoped to a season, and the show page defaults to the active one. A year
 * borrowed from a fallback season would send a reader to last year's
 * nominations.
 */
export function ShowsWall({
  groups,
  className,
}: {
  groups: readonly ShowsWallGroup[];
  className?: string;
}) {
  const populated = groups.filter((group) => group.shows.length > 0);
  if (populated.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {populated.map((group) => {
        const scoring = scoringOf(group.tiers);
        return (
          <section
            key={group.level}
            data-testid={`shows-group-${group.level}`}
            className="flex flex-col gap-3"
          >
            <SectionHead
              as="h3"
              className="pb-0"
              right={scoring ? <StatusChip>{scoring.chip}</StatusChip> : undefined}
            >
              {group.level}
            </SectionHead>
            {scoring ? (
              <p className="text-text-secondary max-w-prose text-sm">
                {scoring.sentence}
              </p>
            ) : null}

            <ul className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">
              {group.shows.map((show) => {
                const body = (
                  <>
                    <ShowLogo imageUrl={show.imageUrl} className="mb-2" />
                    {show.abbreviation ? <Eyebrow>{show.abbreviation}</Eyebrow> : null}
                    <span className="text-text-primary font-serif text-base tracking-[-0.02em]">
                      {showName(show)}
                    </span>
                  </>
                );
                return (
                  <Panel
                    as="li"
                    key={show.eventId}
                    className="hover:bg-bg-surface transition-colors"
                  >
                    {show.abbreviation ? (
                      <Link
                        href={`/award-shows/${show.abbreviation}`}
                        className="focus-visible:outline-accent-fill flex h-full flex-col gap-1 rounded-sm p-4 focus-visible:outline-2"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex h-full flex-col gap-1 p-4">{body}</div>
                    )}
                  </Panel>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
