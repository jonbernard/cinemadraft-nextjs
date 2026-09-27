'use client';

import { useRouter } from 'next/navigation';
import { useId, useOptimistic, useTransition } from 'react';
import type { AdminMode } from '@/lib/utils/admin-mode';
import { cn } from '@/lib/utils/cn';

const LABELS: Record<AdminMode, string> = {
  view: 'View',
  nominations: 'Nominations',
  winners: 'Winners',
};

const ORDER: readonly AdminMode[] = ['view', 'nominations', 'winners'];

/**
 * View / Nominations / Winners — the admin's three jobs on an award show page,
 * as the source app's segmented control had them (`panelEvent.js`).
 *
 * 🔴 **A radio group, and the mode lives in the URL.** Choosing a segment
 * navigates to `?mode=`, which the server renders, so a reload mid-ceremony
 * comes back in the same mode and a link to "the winners screen" can be sent
 * to a second admin — the same reasoning as `?tv=1` (D112). Native radios in
 * a fieldset, so the arrows move the selection and Tab treats the group as
 * one stop without a line of key handling.
 *
 * The selection shows before the server answers (`useOptimistic`), because a
 * control that waits a round trip to acknowledge a press reads as broken.
 *
 * 🔴 **Choosing Winners does not put the show on air.** The source's did — it
 * wrote `awards_active` — so opening the winners view to correct a result a
 * week later put every member's dashboard back to "the results are coming in".
 * Here the mode is one admin's view of the page, and going on air is the Live
 * switch inside Winners, said out loud.
 */
export function AdminModeSwitch({
  mode,
  hrefs,
  className,
}: {
  mode: AdminMode;
  /** Where each segment goes — built by the page, which knows the year. */
  hrefs: Record<AdminMode, string>;
  className?: string;
}) {
  const router = useRouter();
  const name = useId();
  const [shown, setShown] = useOptimistic(mode);
  const [, startTransition] = useTransition();

  const choose = (next: AdminMode) => {
    if (next === shown) return;
    startTransition(() => {
      setShown(next);
      router.push(hrefs[next], { scroll: false });
    });
  };

  return (
    <fieldset
      className={cn('bg-bg-surface inline-flex w-fit gap-1 rounded-sm p-1', className)}
    >
      <legend className="sr-only">Admin mode</legend>
      {ORDER.map((value) => (
        <label key={value} className="flex">
          {/* Native radios: the arrows, the single tab stop and "radio, 2 of
              3, checked" are the platform's, not written here. The input is
              visually hidden and the segment is drawn from its state. */}
          <input
            type="radio"
            name={name}
            value={value}
            checked={value === shown}
            onChange={() => choose(value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'flex min-h-11 cursor-pointer items-center rounded-sm px-4 text-sm',
              'text-text-secondary hover:bg-bg-panel hover:text-text-primary',
              'transition-colors duration-150 motion-reduce:transition-none',
              'peer-focus-visible:outline-accent-fill peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
              // 🔴 The selected segment is marked by a carmine rule as well as
              // a surface step and weight — the rail's and the tab bar's own
              // mark for "you are here". A surface step alone is ~1.2:1
              // against the track, below the 3:1 a state indicator needs.
              'peer-checked:bg-bg-panel peer-checked:text-text-primary peer-checked:font-semibold peer-checked:shadow-[inset_0_-2px_0_var(--color-accent-fill)]',
            )}
          >
            {LABELS[value]}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
