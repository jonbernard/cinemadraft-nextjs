'use client';

import { useCallback, useState, useTransition } from 'react';

import { setActiveYear } from '@/actions/admin/set-active-year';
import { cn } from '@/lib/utils/cn';

export type SeasonRow = {
  year: number;
  isActive: boolean;
};

/**
 * Switch the active season (T48, D22).
 *
 * The source app read `REACT_APP_ACTIVE_YEAR` at build time, so changing
 * seasons meant a redeploy. This is the control that replaces it — and because
 * `setActiveYear` calls `revalidatePath('/', 'layout')`, pressing it re-scopes
 * nearly every page in the product, for every member, with no reload.
 *
 * 🔴 **It confirms, and it names the blast radius** (P17.T28). This used to be
 * ten adjacent "Make active" buttons with no confirmation, on the reasoning
 * that the change is reversible by pressing another one. The row in
 * `available_years` is reversible; the interval is not — between the mis-click
 * and the correction, every member's dashboard, league, draft and award show is
 * scoped to the wrong season. `/admin/broadcast` is the standard this matches:
 * state the count server-side, say it in the form, say it again in a
 * confirmation that interpolates both, and gate the call on it.
 *
 * `window.confirm` rather than a custom dialog, matching `BroadcastPanel`: it
 * is the platform's modal, focus-trapped and keyboard-operable for free, and
 * the two destructive admin actions in this product must not behave
 * differently from one another.
 *
 * 🔴 A `<div>` and a `type="button"`, not a `<form>` — deliberately unlike
 * `BroadcastPanel`. With no form there is no implicit submission, so Enter in
 * the select cannot reach the action at all; the confirmation is not the only
 * thing standing between a keystroke and re-scoping the product.
 *
 * One `<select>` rather than ten buttons: ten mutually-exclusive triggers a few
 * pixels apart is the fat-finger geometry, and this page is opened once a year
 * by someone who has not seen it in twelve months. It also drops ten small
 * targets to one that clears 44px.
 */
export function SeasonControl({
  seasons,
  memberCount,
  className,
}: {
  seasons: readonly SeasonRow[];
  /** Read server-side, so the confirmation names a real number (D22). */
  memberCount: number;
  className?: string;
}) {
  const active = seasons.find((season) => season.isActive)?.year ?? null;
  const [choice, setChoice] = useState<number | null>(active);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const people = memberCount === 1 ? '1 person' : `${memberCount} people`;

  const activate = useCallback(() => {
    // 🔴 Belt and braces with the `disabled` below. The button being off is
    // what a pointer meets; this is what a stale render or a second click in
    // the same tick meets. (There is no Enter path: see the docstring.)
    if (choice == null || choice === active || pending) return;

    if (
      !window.confirm(
        `Make ${choice} the active season? This re-scopes every league, draft, ` +
          `award show and dashboard in the app for all ${people}, immediately. ` +
          `It takes effect with no redeploy and cannot be undone — only replaced ` +
          `by activating another season.`,
      )
    ) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await setActiveYear(choice);
      setMessage(result.ok ? `${choice} is now the active season` : result.message);
    });
  }, [choice, active, people, pending]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <label className="flex flex-col gap-2">
        <span className="text-text-secondary text-sm">Season</span>
        <select
          value={choice ?? ''}
          onChange={(event) => setChoice(Number(event.target.value))}
          disabled={pending}
          className="border-border-rule bg-bg-raised text-text-primary focus-visible:outline-accent-fill tabular min-h-11 w-full max-w-xs border px-3 font-mono text-sm focus-visible:outline-2"
        >
          {seasons.map((season) => (
            <option key={season.year} value={season.year}>
              {season.year}
              {season.isActive ? ' — active' : ''}
            </option>
          ))}
        </select>
      </label>

      {/* Said here as well as in the dialog: someone who dismisses a browser
          modal by reflex must still have read the number. Same rule the
          broadcast form follows. */}
      <p className="text-text-secondary text-sm">
        {/* 🔴 Stated here, in running text. The ten-button version said "Active"
            beside the year in a plain span; after P17.T28 the only other places
            that carry it are an `<option>` suffix and the accessible name of a
            *disabled* button — and a disabled control is out of the tab order
            and skipped in a screen reader's forms mode. */}
        {active == null
          ? 'No season is active today. '
          : `${active} is the active season today. `}
        Changing it re-scopes every league, draft, award show and dashboard for all{' '}
        {people}, immediately and with no redeploy. Only activating another season undoes
        it.
      </p>

      <button
        type="button"
        disabled={pending || choice == null || choice === active}
        onClick={activate}
        className="bg-accent-fill focus-visible:outline-accent-fill min-h-11 w-fit px-4 text-sm text-white focus-visible:outline-2 disabled:opacity-60"
      >
        {pending
          ? 'Activating…'
          : choice == null
            ? 'Pick a season'
            : choice === active
              ? `${choice} is already active`
              : `Make ${choice} active`}
      </button>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {message ?? ''}
      </p>
    </div>
  );
}
