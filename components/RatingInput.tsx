'use client';

import { useCallback } from 'react';

import { cn } from '@/lib/utils/cn';
import { RatingStars } from './RatingStars';

/** Half a star to five, the precision the source's control offered. */
const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

/**
 * Choosing a rating.
 *
 * 🔴 **Radios in a fieldset, not a row of clickable divs** (R14). Ten steps over
 * 0–5 is a single-choice question, which is what a radio group is; built out of
 * divs it would announce nothing, need a keydown handler per arrow key, and
 * submit nothing without JavaScript.
 *
 * 🔴 **The steps are labelled by number, not laid over half a star each.** Half
 * of a 44px star is a 22px target, which fails the touch-target floor — and the
 * source's control was exactly that, so a half-star on a phone was a coin flip
 * between 3 and 3.5. The stars stay as a preview of the chosen value, where
 * nobody has to hit them.
 */
export function RatingInput({
  name,
  value,
  onChange,
  disabled,
  className,
}: {
  name: string;
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-3', className)} disabled={disabled}>
      <legend className="text-text-primary text-sm">Your rating</legend>

      <div className="flex flex-wrap gap-2">
        <Step
          name={name}
          step={null}
          label="None"
          checked={value === null}
          onSelect={onChange}
        />
        {RATING_STEPS.map((step) => (
          <Step
            key={step}
            name={name}
            step={step}
            label={step.toFixed(1)}
            mono
            checked={value === step}
            onSelect={onChange}
          />
        ))}
      </div>

      {/* The preview, so the number chosen above is also the picture. */}
      <p role="status" className="min-h-5">
        {value === null ? (
          <span className="text-text-dim text-sm">No rating</span>
        ) : (
          <RatingStars rating={value} />
        )}
      </p>
    </fieldset>
  );
}

function Step({
  name,
  step,
  label,
  mono,
  checked,
  onSelect,
}: {
  name: string;
  step: number | null;
  label: string;
  mono?: boolean;
  checked: boolean;
  onSelect: (step: number | null) => void;
}) {
  const select = useCallback(() => onSelect(step), [onSelect, step]);

  return (
    <label
      className={cn(
        'flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm px-3 text-sm',
        // The input is visually hidden, so the focus ring has to be drawn by
        // the label around it or a keyboard user has none at all.
        'has-[:focus-visible]:outline-accent-fill has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
        // A surface step and a rule, not carmine: carmine marks the one thing
        // that matters on a page, and a star rating is not urgent. The border
        // is always present so selecting a step does not shift the row by 1px.
        'border',
        checked
          ? 'bg-bg-raised text-text-primary border-text-secondary'
          : 'bg-bg-surface text-text-secondary border-transparent',
        mono && 'tabular font-mono',
      )}
    >
      <input
        type="radio"
        name={name}
        value={label}
        checked={checked}
        onChange={select}
        className="sr-only"
      />
      {label}
    </label>
  );
}
