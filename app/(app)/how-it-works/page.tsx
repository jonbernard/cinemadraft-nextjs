import type { Metadata } from 'next';
import Link from 'next/link';
import { RemoteImage } from '@/components/RemoteImage';
import { ScoringTable } from '@/components/ScoringTable';
import { SectionHead } from '@/components/SectionHead';
import { WorkedExample } from '@/components/WorkedExample';
import { pointRepository } from '@/lib/repositories/points';
import {
  getLandingFacts,
  getShowGroups,
  getWorkedExample,
} from '@/lib/services/how-it-works';
import { groupPointsByLevel } from '@/lib/services/scoring-table';
import { getSeasonPhases } from '@/lib/services/season';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Draft a team of films before awards season, and score every nomination and win they pick up.',
};

/**
 * Breaks a band out of `AppShell`'s content padding and puts it back inside.
 *
 * 🔴 A banded section paints `bg-bg-surface`, never `bg-bg-panel`. The shell's
 * `<main>` **is** a panel, so a panel-toned band is invisible — the first build
 * of this page alternated grounds that rendered as one flat colour, which is
 * exactly the "no sections, just scroll" complaint it was meant to answer.
 * Surface is the step above panel (D90), so a band reads as raised out of the
 * page rather than cut into it.
 */
const BAND = '-mx-4 px-4 xl:-mx-6 xl:px-6';

/**
 * How the game works — the product's front door (Phase 18).
 *
 * Replaces `/rules-and-scoring`, which was two panels of grey prose behind a
 * login wall. Public: `proxy.ts` lists the route, and `next.config.ts`
 * redirects the old URL here permanently (P18.T0, D101).
 *
 * 🔴 **Every number on this page is computed, never typed.** Point values come
 * from the `points` table through `groupPointsByLevel`; the worked example
 * comes from `lib/services/scoring.ts`, the single definition of the scoring
 * rule (D19, D41); dates come from the events table. No testimonials, no
 * metrics, no invented claims (docs/PLAN.md § Phase 18).
 *
 * ## Shape
 *
 * Season order — draft, nominations, wins, the Razzie cost — in **bands**
 * rather than one column, per the owner's call on the first build: it read as
 * documentation because every section had the same rhythm and the same
 * density. What changed is register, not direction: the argument still runs on
 * the season's own order, and the dates are still real.
 *
 * 🔴 **The copy is deliberately thin.** The first version explained each rule
 * in two paragraphs; a reader deciding whether to play does not read two
 * paragraphs. Each rule is one sentence and one real number, and the ledger
 * does the convincing. If a sentence here can be deleted without losing a
 * rule, delete it.
 */
export default async function HowItWorksPage() {
  const [points, example, groups, phases, facts] = await Promise.all([
    pointRepository.findAll(),
    getWorkedExample(),
    getShowGroups(),
    getSeasonPhases(),
    // 🔴 17, not a round number: the first poster spans 2×2, so it eats four
    // cells of a four-column grid and the wall only comes out square at
    // 4 + (n − 1) ≡ 0 (mod 4). 18 left one poster alone on a final row.
    getLandingFacts(17),
  ]);
  const levels = groupPointsByLevel(points);
  // The rulebook carries each level's marks beside its figures; `getShowGroups`
  // already did the awards → points.level join, so this is a lookup, not a
  // second join with its own opinion.
  const showsByLevel = new Map(groups.map((group) => [group.level, group.shows]));
  const withShows = levels.map((level) => ({
    ...level,
    shows: showsByLevel.get(level.level),
  }));

  // 🔴 The three figures the rules are stated with, read out of the points
  // table rather than typed: the top tier of the most valuable level, and the
  // top tier of the negative one. A season that re-prices its categories
  // re-prices this page in the same edit.
  const headline = levels[0];
  const nomination = headline?.tiers[0]?.points ?? null;
  const negative = levels.find((level) => level.tiers.some((tier) => tier.points < 0));
  const cost = negative?.tiers[0]?.points ?? null;

  const firstNominations = phases.find((phase) => phase.phase === 'nominations') ?? null;
  const lastCeremony =
    [...phases]
      .reverse()
      .find((phase) => phase.phase === 'ceremony' && phase.date != null) ?? null;
  const months =
    firstNominations?.date != null && lastCeremony?.date != null
      ? Math.max(
          1,
          Math.round((lastCeremony.date - firstNominations.date) / 2_629_800_000),
        )
      : null;

  return (
    <div className="flex flex-col">
      {/* The hero: the claim on the left, the season's real artwork on the
          right. 🔴 The posters are the highest-scoring films of the season
          being shown, with what they have actually scored — the product's own
          evidence, where a SaaS page would put a product screenshot and a
          stock photograph. */}
      <section
        className={`${BAND} flex flex-col gap-10 pb-12 pt-4 lg:flex-row lg:items-center lg:gap-12 lg:pb-16`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <h1 className="text-text-primary max-w-[16ch] font-sans text-display font-semibold">
            Draft a team of films. Let the awards keep score.
          </h1>
          <p className="text-text-secondary max-w-prose text-sm leading-relaxed sm:text-base">
            Pick before the nominations land &mdash; then every nomination pays, every win
            pays twice, and every Razzie takes points back.
          </p>
          {facts ? (
            <dl
              data-testid="landing-facts"
              className="border-border-rule flex flex-wrap gap-x-10 gap-y-4 border-t pt-6"
            >
              {[
                [facts.shows, 'award shows score'],
                [
                  facts.filmsScored,
                  `films scoring ${facts.isActiveSeason ? 'this season' : `in ${facts.year}`}`,
                ],
                [facts.seasons, 'seasons played'],
              ].map(([value, label]) => (
                <div key={String(label)} className="flex flex-col gap-1">
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-text-primary font-mono text-2xl">{value}</dd>
                  <p className="text-text-dim text-xs">{label}</p>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/auth/register"
              className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Start a league
            </Link>
            <Link
              href="/"
              className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center px-1 text-sm underline underline-offset-4 focus-visible:outline-2"
            >
              See this season
            </Link>
          </div>
        </div>

        {facts && facts.films.length > 0 ? (
          /* A wall of the season's real posters, not an illustration. The
              films are the highest scorers of the season being shown, in
              order, so the mosaic is a picture of the game actually being
              played — and every title in it is one somebody drafted.

              Deliberately unlabelled: the captions and the point totals sat
              under three posters in the first build and competed with the
              headline. What each one scored is a click away on its own page;
              here they are artwork. The bottom fades so the wall reads as
              continuing past the fold rather than stopping in a straight cut. */
          <div
            data-testid="hero-films"
            // 🔴 Decorative, and that is a decision rather than laziness. As
            // links these eighteen posters put eighteen tab stops between the
            // headline and "Start a league" — the action the page exists for —
            // and a screen reader would read eighteen film titles before
            // reaching the sentence that explains what the product is. The
            // same films are reachable, titled and linked, from the season
            // page this hero links to. So: `aria-hidden`, no tab stops, no
            // accessible names, and every `alt` empty.
            aria-hidden="true"
            className="grid w-full shrink-0 grid-cols-4 gap-2 [mask-image:linear-gradient(to_bottom,black_72%,transparent)] sm:grid-cols-6 lg:w-[30rem] lg:grid-cols-4"
          >
            {facts.films.map((film, index) => (
              <div
                key={film.movieId}
                className={
                  index === 0
                    ? 'poster-radius bg-bg-surface relative col-span-2 row-span-2 aspect-[2/3] overflow-hidden'
                    : 'poster-radius bg-bg-surface relative aspect-[2/3] overflow-hidden'
                }
              >
                {film.posterUrl ? (
                  <RemoteImage
                    src={film.posterUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 8rem, 25vw"
                    className="object-cover"
                    priority={index === 0}
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* The rules, as three statements with a real number each. */}
      <section
        data-testid="scoring-rules"
        className={`${BAND} bg-bg-surface flex flex-col gap-8 py-12`}
      >
        <SectionHead as="h2">How the scoring works</SectionHead>
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <p className="text-text-primary font-mono text-2xl">{nomination ?? '—'}</p>
            <p className="text-text-secondary text-sm leading-relaxed">
              A nomination pays its category.{' '}
              {headline ? `${headline.level}, top tier.` : null}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-brass-text font-mono text-2xl">
              {nomination == null ? '—' : nomination * 2}
            </p>
            <p className="text-text-secondary text-sm leading-relaxed">
              A win pays it again. The same category, a second time.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-accent-text font-mono text-2xl">{cost ?? '—'}</p>
            <p className="text-text-secondary text-sm leading-relaxed">
              A Razzie nomination takes points off you.{' '}
              {negative ? `${negative.level}.` : null}
            </p>
          </div>
        </div>
      </section>

      {/* The proof. One ledger, real, and it adds up. */}
      {example ? (
        <section className={`${BAND} flex flex-col gap-6 py-12`}>
          <SectionHead
            as="h2"
            right={
              <span className="text-text-dim font-sans text-xs">
                {example.isActiveSeason ? 'This season' : example.year}
              </span>
            }
          >
            The best team in the game picked this
          </SectionHead>
          <WorkedExample
            title={example.best.title}
            posterUrl={example.best.posterUrl}
            total={example.best.total}
            lines={example.best.lines}
            limit={4}
          />
        </section>
      ) : null}

      {/* The cost. 🔴 A full ledger, not a headline number: the owner asked
          for the film examples back, and the casualty is the funnier of the
          two — the same table shape as the winner above, which is the point.
          Reading them one after another is what makes the inversion land. */}
      {example?.worst ? (
        <section className={`${BAND} bg-bg-surface flex flex-col gap-6 py-12`}>
          <SectionHead
            as="h2"
            right={
              <span className="text-accent-text font-mono text-sm">
                {example.worst.total}
              </span>
            }
          >
            And somebody drafted this
          </SectionHead>
          <WorkedExample
            title={example.worst.title}
            posterUrl={example.worst.posterUrl}
            total={example.worst.total}
            lines={example.worst.lines}
            limit={4}
          />
        </section>
      ) : null}

      {/* The shows and their values, in one pass. 🔴 These were two sections
          — a wall of twelve marks, then the same four groups again as figures.
          One idea, read twice. The marks now sit beside their own numbers. */}
      {/* 🔴 The whole band is conditional, heading included. `ScoringTable`
          returns null for no levels, which on a fresh database left the
          heading "Twelve shows, and what each pays" sitting above nothing. */}
      {withShows.length > 0 ? (
        <section className={`${BAND} bg-bg-surface flex flex-col gap-6 py-12`}>
          <SectionHead
            as="h2"
            right={
              months == null ? undefined : (
                <span className="text-text-dim font-sans text-xs">
                  about {months} months, start to finish
                </span>
              )
            }
          >
            Twelve shows, and what each pays
          </SectionHead>
          <ScoringTable levels={withShows} />
        </section>
      ) : null}

      <section className={`${BAND} flex flex-col items-start gap-4 py-12`}>
        <SectionHead as="h2">Start a league</SectionHead>
        <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
          Private, invite-only, one season at a time.
        </p>
        <Link
          href="/auth/register"
          className="bg-accent-fill focus-visible:outline-accent-fill flex min-h-11 items-center rounded-sm px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Start a league
        </Link>
      </section>
    </div>
  );
}
