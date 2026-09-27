'use client';

import { useOptimistic, useState, useTransition } from 'react';

import { updateEvent } from '@/actions/admin/update-event';
import { LiveSwitch } from '@/components/admin/LiveSwitch';

/**
 * Put the ceremony on air, or take it off (`events.awards_active`).
 *
 * In Winners mode, beside the categories it is about, rather than in "Edit this
 * show": it is pressed on the night, twice, and a switch in a dialog behind a
 * Save button is two steps away from the job. It saves as it flips — a switch
 * that needs a Save is a checkbox dressed as one.
 *
 * On air is what makes `/live/[abbr]` stream (it answers 204 without, D110)
 * and what puts the dashboard's "watch live" banner up (D118) — the same two
 * things the source's Pick Winners mode switched on, here said out loud rather
 * than done as a side effect of opening a view.
 */
export function OnAirSwitch({
  eventId,
  onAir,
  className,
}: {
  eventId: number;
  onAir: boolean;
  className?: string;
}) {
  const [shown, setShown] = useOptimistic(onAir);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const flip = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      setShown(next);
      const result = await updateEvent({ eventId, awardsActive: next });
      if (!result.ok) setError(result.message);
    });
  };

  return (
    <div className={className}>
      <LiveSwitch
        checked={shown}
        onChange={flip}
        disabled={pending}
        description="On air, /live streams this show and every member's dashboard links to it."
      />
      <p aria-live="polite" className="text-accent-text min-h-5 text-xs">
        {error ?? ''}
      </p>
    </div>
  );
}
