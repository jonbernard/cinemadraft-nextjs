import type { Metadata } from 'next';

import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';
import { pointRepository } from '@/lib/repositories/points';
import { groupPointsByLevel } from '@/lib/services/scoring-table';

export const metadata: Metadata = {
  title: 'Rules & scoring',
  description: 'How a draft works, and how points are earned.',
};

/**
 * Rules and scoring, explained (T46) and the scoring rulebook by tier (T47) —
 * one page, two sections, matching how the source app arranged it: the prose
 * explains the rule, the table shows the numbers.
 *
 * Public, like the award-show pages this explains.
 */
export default async function RulesAndScoringPage() {
  const points = await pointRepository.findAll();
  const levels = groupPointsByLevel(points);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <SectionHead as="h1">Rules & scoring</SectionHead>

      <Panel tone="raised" as="section" className="flex flex-col gap-4 p-5">
        <SectionHead as="h2" className="pb-0">
          The rules
        </SectionHead>

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
      </Panel>

      <Panel tone="raised" as="section" className="flex flex-col gap-4 p-5">
        <SectionHead as="h2" className="pb-0">
          The scoring rulebook
        </SectionHead>
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
    </div>
  );
}
