import type { Metadata } from 'next';

import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { pointRepository } from '@/lib/repositories/points';
import { groupPointsByLevel } from '@/lib/services/scoring-table';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Draft a team of films before awards season, and score every nomination and win they pick up.',
};

/**
 * How the game works — the product's front door (Phase 18).
 *
 * Replaces `/rules-and-scoring`, which was two panels of grey prose behind a
 * login wall. Public: `proxy.ts` lists the route, and `next.config.ts`
 * redirects the old URL here permanently (P18.T0, D101).
 *
 * 🔴 **Every number on this page is computed, never typed.** The point values
 * come from the `points` table through `groupPointsByLevel`; the worked
 * example comes from `lib/services/scoring.ts`, which is the single definition
 * of the scoring rule (D19, D41). A hand-written figure here drifts the first
 * time the points table changes, and this is the page where being wrong is
 * most embarrassing — so there are none, and `e2e/how-it-works.spec.ts` holds
 * that line.
 *
 * No testimonials, no logos-of-companies-using-us, no invented metrics
 * (docs/PLAN.md § Phase 18). If a figure cannot be sourced it is not here.
 *
 * 🔴 P18.T1 is a **move, not a rewrite**: every word below came over from the
 * old route unchanged, so the product was never worse than what it replaced at
 * any commit. T2–T7 rewrite the content section by section.
 */
export default async function HowItWorksPage() {
  const points = await pointRepository.findAll();
  const levels = groupPointsByLevel(points);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <SectionHead as="h1">How it works</SectionHead>
        {/* 🔴 The Razzie clause is here on purpose, and it is the one deviation
            from the spine in docs/PLAN.md § Phase 18. The PLAN says the twist
            being the eighth paragraph is why this phase exists, and the spine
            then puts its section sixth of seven — so the lede carries it above
            the fold at 390px while the section stays where the spine puts it. */}
        <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
          Draft a team of films before awards season, then score every nomination and win
          they pick up &mdash; and lose points when one of them takes a Razzie nomination.
        </p>
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: these are shareable fragments — `/how-it-works#points` is a link somebody sends — so they have to be stable and readable, and `useId()` emits React 19's «r0» form. The rule guards a component rendered twice; a page renders once, the same invariant `AppShell` cites for the skip link. */}
      <section id="what-it-is" className="flex flex-col gap-4">
        <SectionHead as="h2">What the game is</SectionHead>
        <p className="text-text-secondary text-sm">The award shows we include:</p>
        <ul className="text-text-secondary list-disc pl-5 text-sm">
          <li>
            Alphabet Awards — the Writers Guild, Directors Guild, Producers Guild, Screen
            Actors&rsquo; Guild, Art Directors Guild, American Society of
            Cinematographers, BAFTA, American Cinema Editors, and the American Film
            Institute
          </li>
          <li>Golden Globes</li>
          <li>Academy Awards</li>
          <li>Razzies</li>
        </ul>

        <p className="text-text-secondary text-sm">
          For the Golden Globes, Academy Awards and the Razzies, categories are split into
          tiers, and a more important category is worth more. The tiers are:
        </p>
        <ul className="text-text-secondary list-disc pl-5 text-sm">
          <li>Tier 1: Best Picture</li>
          <li>Tier 2: Acting, writing and directing</li>
          <li>Tier 3: Every other category given out during the televised event</li>
        </ul>
        <p className="text-text-secondary text-sm">
          Alphabet Awards categories are not tiered — every category is worth the same.
        </p>

        <p className="text-text-secondary text-sm">
          You can pick any movie you want. There is no authoritative list you have to pick
          from — you are free to pick something that came out five years ago, but the
          league will mock you for it.
        </p>

        <p className="text-text-secondary text-sm">
          Be careful: the Razzies are worth negative points, so if one of your movies
          picks up a Razzie nomination, it costs you.
        </p>

        <p className="text-text-secondary text-sm">
          {/* 🔴 Deliberately different from the source app's copy, which said a
              nomination and a win were worth "the same value" — that was never
              what the scoring code did (see lib/services/scoring.ts): a win was
              already worth double, because a winner was necessarily also a
              nominee. This page states the rule the app actually runs. */}
          A nomination earns a category&rsquo;s points. A win earns it a second time —
          twice a nomination&rsquo;s value in total — because winning a category means you
          were nominated for it too.
        </p>
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: these are shareable fragments — `/how-it-works#points` is a link somebody sends — so they have to be stable and readable, and `useId()` emits React 19's «r0» form. The rule guards a component rendered twice; a page renders once, the same invariant `AppShell` cites for the skip link. */}
      <section id="season" className="flex flex-col gap-4">
        <SectionHead as="h2">How a season runs</SectionHead>
        {/* P18.T5 fills this. */}
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: these are shareable fragments — `/how-it-works#points` is a link somebody sends — so they have to be stable and readable, and `useId()` emits React 19's «r0» form. The rule guards a component rendered twice; a page renders once, the same invariant `AppShell` cites for the skip link. */}
      <section id="points" className="flex flex-col gap-4">
        <SectionHead as="h2">How points work</SectionHead>
        {/* P18.T2 inserts the worked example here, ABOVE the table (P18.T0). */}
        <Panel tone="surface" as="div" className="flex flex-col gap-4 p-5">
          <p className="text-text-secondary text-sm">
            What a nomination is worth, by award show and tier. A win is worth this twice.
          </p>

          <div className="overflow-x-auto">
            <table className="tabular w-full text-left text-sm">
              <thead>
                <tr className="text-text-dim font-sans text-xs uppercase tracking-[0.06em]">
                  <th scope="col" className="py-2 pr-4 font-semibold">
                    Award show
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">
                    Tier 1
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">
                    Tier 2
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Tier 3
                  </th>
                </tr>
              </thead>
              <tbody>
                {levels.map((row) => (
                  <tr key={row.level} className="border-border-rule border-t">
                    <th scope="row" className="text-text-primary py-2 pr-4 font-normal">
                      {row.level}
                    </th>
                    {[1, 2, 3].map((tier) => {
                      const cell = row.tiers.find((t) => t.tier === tier);
                      return (
                        <td
                          key={tier}
                          className={
                            tier === 3
                              ? 'text-text-secondary py-2 text-right'
                              : 'text-text-secondary py-2 pr-4 text-right'
                          }
                        >
                          {cell ? cell.points : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: these are shareable fragments — `/how-it-works#points` is a link somebody sends — so they have to be stable and readable, and `useId()` emits React 19's «r0» form. The rule guards a component rendered twice; a page renders once, the same invariant `AppShell` cites for the skip link. */}
      <section id="shows" className="flex flex-col gap-4">
        <SectionHead as="h2">The shows</SectionHead>
        {/* P18.T4 fills this. */}
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: these are shareable fragments — `/how-it-works#points` is a link somebody sends — so they have to be stable and readable, and `useId()` emits React 19's «r0» form. The rule guards a component rendered twice; a page renders once, the same invariant `AppShell` cites for the skip link. */}
      <section id="razzies" className="flex flex-col gap-4">
        <SectionHead as="h2">What it costs you</SectionHead>
        {/* P18.T2 fills this with the season's real casualty. */}
      </section>

      {/* biome-ignore lint/correctness/useUniqueElementIds: these are shareable fragments — `/how-it-works#points` is a link somebody sends — so they have to be stable and readable, and `useId()` emits React 19's «r0» form. The rule guards a component rendered twice; a page renders once, the same invariant `AppShell` cites for the skip link. */}
      <section id="start" className="flex flex-col gap-4">
        <SectionHead as="h2">Start</SectionHead>
        {/* P18.T7 fills this. */}
      </section>
    </div>
  );
}
