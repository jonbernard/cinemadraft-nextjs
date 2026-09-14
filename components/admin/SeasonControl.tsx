'use client';

import { useCallback, useState, useTransition } from 'react';

import { setActiveYear } from '@/actions/admin/set-active-year';
import { useConfirm } from '@/components/ui/ConfirmDialog';
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
 * 🔴 **`ConfirmDialog`, not `window.confirm` — and this reverses what stood
 * here (P14).** The claim was that `window.confirm` is the platform's modal,
 * focus-trapped and keyboard-operable for free, and that the two destructive
 * admin actions must not behave differently from one another. The first half
 * was true and is no longer a reason: `showModal()` on a native `<dialog>`
 * gives the same focus trap, the same Escape key, page inertness and top-layer
 * stacking, so the free accessibility was never what `window.confirm` alone
 * bought. What it *costs* is that the confirmation is browser chrome — drawn
 * by the browser, in the browser's type, at the top of the viewport, prefixed
 * with "cinemadraft.com says", and impossible for this product to style or
 * place. The owner saw one on `/leagues/[id]/setup` and overruled the note.
 *
 * The consistency half now argues the opposite way. `window.confirm` made
 * these two admin actions match each other and match nothing else: there were
 * nine call sites in five files, each free to drift. All nine render
 * `components/ui/ConfirmDialog` now, so they behave identically because they
 * are the same component rather than because everybody remembered.
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
  const { confirm, dialog } = useConfirm();

  const people = memberCount === 1 ? '1 person' : `${memberCount} people`;

  const activate = useCallback(async () => {
    // 🔴 Belt and braces with the `disabled` below. The button being off is
    // what a pointer meets; this is what a stale render or a second click in
    // the same tick meets. (There is no Enter path: see the docstring.)
    if (choice == null || choice === active || pending) return;

    if (
      !(await confirm(
        `Make ${choice} the active season? This re-scopes every league, draft, ` +
          `award show and dashboard in the app for all ${people}, immediately. ` +
          `It takes effect with no redeploy and cannot be undone — only replaced ` +
          `by activating another season.`,
        `Make ${choice} active`,
      ))
    ) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await setActiveYear(choice);
      setMessage(result.ok ? `${choice} is now the active season` : result.message);
    });
  }, [choice, active, people, pending, confirm]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {dialog}
      <label className="flex flex-col gap-2">
        <span className="text-text-secondary text-sm">Season</span>
        <select
          value={choice ?? ''}
          onChange={(event) => setChoice(Number(event.target.value))}
          disabled={pending}
          className="border-border-rule bg-bg-surface text-text-primary focus-visible:outline-accent-fill tabular min-h-11 w-full max-w-xs border px-3 font-mono text-sm focus-visible:outline-2"
        >
          {seasons.map((season) => (
            <option key={season.year} value={season.year}>
              {season.year}
              {season.isActive ? ' — active' : ''}
            </option>
          ))}
        </select>
      </label>

      {/* Said here as well as in the dialog: someone who dismisses a modal
          by reflex must still have read the number. Same rule the broadcast
          form follows. */}
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
