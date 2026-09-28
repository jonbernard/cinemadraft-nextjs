'use client';

import { useState, useTransition } from 'react';

import { setActiveYear } from '@/actions/admin/set-active-year';
import { startNextSeason } from '@/actions/admin/start-next-season';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { SectionHead } from '@/components/ui/SectionHead';
import { cn } from '@/lib/utils/cn';

export type SeasonRow = {
  year: number;
  isActive: boolean;
};

/**
 * Start the next season, or switch back one (T48, D22, D138).
 *
 * Two acts, not a list of years. The owner starts a season once a year and
 * wanted "a 'create next year' button"; nothing older than the season before
 * is ever needed, so nothing older is offered (D138). "Start the 2027 season"
 * creates 2027's row and makes it active in one step (`startNextSeason`,
 * idempotent: a second press starts nothing). "Switch back to 2025" is the
 * escape hatch for a season started by mistake.
 *
 * 🔴 **One button, not a select, for the switch back.** The select used to
 * exist because ten "Make active" buttons a few pixels apart was the
 * fat-finger geometry (P17.T28). Limited to the active season and the one
 * before, a select holds one real choice and the current state, and takes two
 * gestures to say one thing. A button says exactly what it does.
 *
 * 🔴 **Both confirm, and name the blast radius** (P17.T28), through
 * `ConfirmDialog` rather than `window.confirm` (P14: browser chrome cannot be
 * styled or placed). Both actions call `revalidatePath('/', 'layout')`, so a
 * press re-scopes every page for every member, with no reload.
 *
 * 🔴 `type="button"` in a `<div>`, not a `<form>`: no implicit submission, so
 * no keystroke reaches either action without its confirmation.
 *
 * The limit is computed here from `seasons`, so the page stays a plain read.
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
  // `getActiveYear`'s rule: the flagged row, else the newest.
  const active =
    seasons.find((season) => season.isActive)?.year ??
    (seasons.length ? Math.max(...seasons.map((season) => season.year)) : null);
  const next = active == null ? null : active + 1;
  const back =
    active != null && seasons.some((season) => season.year === active - 1)
      ? active - 1
      : null;

  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const people = memberCount === 1 ? '1 person' : `${memberCount} people`;

  async function start() {
    // Belt and braces with `disabled`: a stale render or a second click in the
    // same tick meets this.
    if (next == null || pending) return;
    if (
      !(await confirm(
        `Start the ${next} season? Every league, draft, award show and dashboard ` +
          `moves to ${next} for all ${people}, now. Members see “not set up yet” ` +
          `until their league’s owner opens ${next}.`,
        `Start ${next}`,
      ))
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await startNextSeason(next);
      setMessage(
        !result.ok
          ? result.message
          : result.data.started
            ? `${next} is now the active season`
            : `${next} was already started`,
      );
    });
  }

  async function switchBack() {
    if (back == null || pending) return;
    if (
      !(await confirm(
        `Switch back to ${back}? Every league, draft, award show and dashboard ` +
          `moves back to ${back} for all ${people}, now. ${active} keeps everything ` +
          `in it, and starting it again brings it back.`,
        `Switch to ${back}`,
      ))
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await setActiveYear(back);
      setMessage(result.ok ? `${back} is now the active season` : result.message);
    });
  }

  if (active == null || next == null) {
    return <p className="text-text-secondary text-sm">No seasons exist yet.</p>;
  }

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      {dialog}

      {/* In running text, where a screen reader reaches it — not only in a
          button's name. */}
      <p className="text-text-primary text-sm">{active} is the active season.</p>

      <section className="flex flex-col gap-3">
        <SectionHead as="h2">Start the next season</SectionHead>
        <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
          Moves the whole app to {next} for all {people}. Each league shows a “not set up
          yet” notice until its owner opens {next}. {active} stays exactly as it is.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={start}
          className="bg-accent-fill focus-visible:outline-accent-fill min-h-11 w-fit px-4 text-sm text-white focus-visible:outline-2 disabled:opacity-60"
        >
          {pending ? 'Working…' : `Start the ${next} season`}
        </button>
      </section>

      {back != null && (
        <section className="flex flex-col gap-3">
          <SectionHead as="h2">Switch back</SectionHead>
          <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
            For a season started by mistake. Moves everyone back to {back}.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={switchBack}
            className="border-border-rule text-text-primary hover:bg-bg-surface focus-visible:outline-accent-fill min-h-11 w-fit border px-4 text-sm focus-visible:outline-2 disabled:opacity-60"
          >
            {`Switch back to ${back}`}
          </button>
        </section>
      )}

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {message ?? ''}
      </p>
    </div>
  );
}
