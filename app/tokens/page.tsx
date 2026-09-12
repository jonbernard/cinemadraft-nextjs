import type { Metadata } from 'next';

import { Button } from '@/components/Button';
import { NOINDEX } from '@/lib/seo';

/**
 * The cascade-layer probe (P15.T11 follow-up).
 *
 * 🔴 **This page exists only so `e2e/smoke.spec.ts` has something to measure.**
 * The MUI/Tailwind arrangement it pins (D29) fails *silently* — get the layer
 * order wrong and the app still builds, still renders, and simply looks wrong
 * in ways that are easy to misattribute to a component. Those three assertions
 * are the only automated guard on it, and `AGENTS.md` says not to relax them.
 *
 * Its ancestor was a palette gallery for the retired visual system, correctly
 * deleted in `f15bc65` — which took the probe with it and left the three tests
 * red against a 404 for three weeks. This is the probe alone: two buttons and a
 * wordmark, no gallery to rot. Do not grow it back into a design-system page;
 * Storybook is where components are reviewed.
 *
 * Public, because the assertions read computed styles from a real browser and a
 * signed-out one is the simplest browser to point at it. `data-testid` is
 * stripped from production output anyway (`next.config.ts`), so outside the
 * `KEEP_TEST_IDS=1` build this is two unremarkable buttons.
 */
export const metadata: Metadata = {
  title: 'Cascade layers',
  robots: NOINDEX,
};

export default function TokensPage() {
  return (
    <main className="bg-bg-base text-text-primary flex min-h-dvh flex-col items-start gap-8 p-8">
      {/* 🔴 Plain text, deliberately. The smoke run's "the page renders" check
          only needs this word on screen, and the markup this page was rebuilt
          from carried `font-display`, `uppercase` and the Archivo `wdth` axis —
          all three retired by D69–D77. Copying a deleted page brought them back
          with it, which is exactly how a retired primitive returns: not by
          decision, but by transcription. */}
      <span className="text-lg">Cinemadraft</span>

      <div className="flex flex-wrap items-center gap-4">
        {/* A themed background proves Tailwind's preflight did not strip MUI —
            preflight resets buttons to transparent, so a colour here means the
            `mui` layer sits above `base`. */}
        <Button variant="contained" data-testid="mui-button">
          MUI button
        </Button>

        {/* And black here proves a utility still beats MUI, which means `mui`
            sits below `utilities`. Between them the two buttons pin both edges
            of the order — neither alone would. */}
        <Button variant="contained" className="bg-black" data-testid="tailwind-wins">
          Tailwind wins
        </Button>
      </div>
    </main>
  );
}
