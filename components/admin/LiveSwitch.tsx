'use client';

import { useId } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * One switch: the ceremony is on air, or it is not (`events.awards_active`).
 *
 * A native checkbox with `role="switch"`, so Space toggles it, a label click
 * toggles it, and a screen reader announces "switch, on" — none of it written
 * by hand. The box itself is visually hidden and the track is drawn beside it
 * from `peer-*` state, so the focus ring, the checked colour and the thumb all
 * follow the real input rather than a copy of its state.
 *
 * Carmine when on: "live / now" is carmine's job (D69), and this changes no
 * scoring input. The state is also said in words beside the track, so it does
 * not rest on colour or on which end the thumb is at.
 */
export function LiveSwitch({
  checked,
  onChange,
  label = 'Live',
  description,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}) {
  const descriptionId = useId();

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          aria-checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={description ? descriptionId : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'bg-bg-surface relative inline-block h-6 w-11 shrink-0 rounded-full',
            'transition-colors duration-150 motion-reduce:transition-none',
            'peer-checked:bg-accent-fill',
            'peer-focus-visible:outline-accent-fill peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
            // The thumb. Secondary ink off, white on carmine: both clear 3:1
            // against their track, which is what a control's state needs.
            'after:bg-text-secondary after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full',
            'after:transition-transform after:duration-150 motion-reduce:after:transition-none',
            'peer-checked:after:translate-x-5 peer-checked:after:bg-white',
          )}
        />
        <span className="text-text-primary text-sm font-semibold">{label}</span>
        {/* Hidden from the accessibility tree: the switch already says "on" or
            "off", and saying it twice reads as two controls. */}
        <span aria-hidden="true" className="text-text-secondary text-sm">
          {checked ? 'On air' : 'Off air'}
        </span>
      </label>
      {description ? (
        <p id={descriptionId} className="text-text-secondary text-xs">
          {description}
        </p>
      ) : null}
    </div>
  );
}
