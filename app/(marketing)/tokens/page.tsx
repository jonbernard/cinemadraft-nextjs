import Button from '@mui/material/Button';

import { LetterboxRule } from '@/components/LetterboxRule';
import { PosterFrame } from '@/components/PosterFrame';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * The design system, rendered.
 *
 * This is the phase gate from docs/PLAN.md: both themes visible, every colour
 * arriving through a token. Not a throwaway — it is where a palette change is
 * checked before it reaches a page anyone uses, so it stays in the app.
 *
 * No colour on this page is written as a hex literal, including in the
 * swatches. A hex here would be a colour outside the system, which is exactly
 * what the page exists to make impossible; the `layering` CI job enforces it.
 */
const SWATCHES = [
  ['bg.base', 'bg-bg-base'],
  ['bg.surface', 'bg-bg-surface'],
  ['bg.raised', 'bg-bg-raised'],
  ['border.rule', 'bg-border-rule'],
  ['text.primary', 'bg-text-primary'],
  ['text.secondary', 'bg-text-secondary'],
  ['text.dim', 'bg-text-dim'],
  ['accent.fill', 'bg-accent-fill'],
  ['accent.text', 'bg-accent-text'],
  ['beam', 'bg-beam'],
] as const;

/** Real 2026 titles — placeholder names hide how badly long ones wrap. */
const FILMS = [
  { title: 'Sinners', status: 'won' as const },
  { title: 'One Battle After Another', status: 'nominated' as const },
  { title: 'Is This Thing On?', status: 'none' as const },
  { title: 'Wake Up Dead Man: A Knives Out Mystery', status: 'none' as const },
  { title: 'Marty Supreme', status: 'none' as const },
];

export default function TokensPage() {
  return (
    <main className="bg-bg-base text-text-primary min-h-dvh p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex items-center justify-between">
          {/* The wordmark alone until the logo mark is decided (§6.10). The
              MUI Minimal pinwheel is not ours and must not appear. */}
          <span className="font-display text-lg font-bold uppercase [font-variation-settings:'wdth'_120]">
            Cinemadraft
          </span>
          <ThemeToggle />
        </header>

        <LetterboxRule as="h1">Palette</LetterboxRule>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map(([name, cls]) => (
            <li key={name} className="flex flex-col gap-1">
              <span className={`border-border-rule block h-14 w-full border ${cls}`} />
              <span className="text-text-secondary font-mono text-xs">{name}</span>
            </li>
          ))}
        </ul>

        <LetterboxRule>Type</LetterboxRule>
        <div className="flex flex-col gap-3">
          <p className="font-display text-3xl font-bold uppercase tracking-tight [font-variation-settings:'wdth'_120]">
            Best Picture
          </p>
          <p className="text-text-secondary max-w-prose text-sm">
            Body copy in Archivo at its normal width. The display face above is the same
            family on its width axis — one family doing two jobs, which is why the page
            holds together without a second typeface.
          </p>
          <p className="text-text-dim tabular font-mono text-sm">
            120 · 095 · 040 · 000 — tabular figures, so a column never jitters as scores
            change
          </p>
        </div>

        <LetterboxRule>Cascade layers</LetterboxRule>
        {/* The probe for the MUI/Tailwind layer contract (D29), asserted by
            e2e/smoke.spec.ts. It lives here rather than on the home page
            because the home page is now the dashboard and requires a session
            — a signed-out smoke run would only ever see a redirect.

            This is also its natural home: the contract is part of the design
            system, and this is the page that demonstrates the design system. */}
        <div className="flex flex-wrap items-center gap-4">
          {/* A themed background proves Tailwind preflight did not strip MUI. */}
          <Button variant="contained" data-testid="mui-button">
            MUI button
          </Button>
          {/* A black background proves a Tailwind utility overrides MUI. */}
          <Button variant="contained" className="bg-black" data-testid="tailwind-wins">
            Tailwind wins
          </Button>
        </div>

        <LetterboxRule>Roster strip</LetterboxRule>
        {/* No count is assumed anywhere (D34) — this happens to be five. */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          {FILMS.map((film, i) => (
            <PosterFrame
              key={film.title}
              title={film.title}
              posterUrl={null}
              round={i + 1}
              points={(FILMS.length - i) * 10}
              share={(FILMS.length - i) / 15}
              status={film.status}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
