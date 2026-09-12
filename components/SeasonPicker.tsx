import Link from 'next/link';

import { cn } from '@/lib/utils/cn';

/**
 * The leaderboard's season control (P17.T4).
 *
 * 🔴 Replaces a flat row of one `<Link>` per season. With ten seasons that was
 * ten targets measured at **33.6 × 20px** — under a quarter of the 44px
 * minimum — wrapping across the right slot of a `SectionHead`. The year the
 * reader is on was one underline among ten.
 *
 * 🔴 A native `<details>`, not a `<select>` and not a JavaScript menu. The
 * years have to stay real links: Back, open-in-new-tab and `aria-current` are
 * all things the flat row got right and none of them survive a `<select>` that
 * navigates on change, which also does nothing at all before hydration.
 * `<details>` brings the disclosure, the keyboard handling and the
 * expanded-state announcement from the platform — the same argument D75 makes
 * for `<dialog>`.
 *
 * The current year renders in the summary, so the season on screen is legible
 * without opening anything.
 */
export function SeasonPicker({
  year,
  seasons,
  className,
}: {
  /** The season currently on screen. */
  year: number;
  /** Every season with data, newest first, as `availableSeasons()` returns them. */
  seasons: readonly number[];
  className?: string;
}) {
  // One season is not a choice. The page used to apply this guard itself.
  if (seasons.length <= 1) return null;

  return (
    /* No explicit `role="group"`: `<details>` already maps to one, and adding
       it is the redundancy Biome's `noRedundantRoles` catches. The label is
       what makes the group findable — "Season", which is what the flat `<nav>`
       it replaces was labelled. */
    <details aria-label="Season" className={cn('relative', className)}>
      {/* `list-none` kills the disclosure triangle in Chrome; the
          `::-webkit-details-marker` rule is what kills it in Safari, which
          ignores `list-style` on a summary. */}
      <summary className="text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 cursor-pointer list-none items-center gap-2 focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
        <span className="tabular font-mono">{year}</span>
        <span aria-hidden="true" className="text-text-dim text-xs">
          ▾
        </span>
      </summary>

      {/* Absolute so the open list does not shove the table down — the control
          lives in a `SectionHead` right slot and the section below it must not
          move under the reader's finger. */}
      <ul className="bg-bg-raised absolute right-0 z-20 mt-1 flex max-h-64 flex-col overflow-y-auto rounded-md p-1">
        {seasons.map((entry) => (
          <li key={entry}>
            <Link
              href={`/?year=${entry}`}
              aria-current={entry === year ? 'page' : undefined}
              className={cn(
                'focus-visible:outline-accent-fill tabular flex min-h-11 items-center justify-end rounded-sm px-4 font-mono text-sm focus-visible:outline-2',
                entry === year
                  ? 'text-accent-text'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {entry}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
