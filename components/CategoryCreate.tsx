'use client';

import { useCallback, useId, useState, useTransition } from 'react';

import { createCategory } from '@/actions/awards/create-category';
import { cn } from '@/lib/utils/cn';

export type PointTier = {
  id: number;
  level: string;
  tier: number;
  points: number;
};

/**
 * Add a category to a show (T27).
 *
 * 🔴 The tier `<select>` is the whole reason this is not a plain "points"
 * number field. `awards.points` is a foreign key into `points.id`, not a
 * point value (D41) — a form that let an admin type a number would let them
 * type, say, `20`, thinking that is what the category is worth, and instead
 * silently attach whichever tier happens to have id 20. Choosing from the
 * real table is the only way this cannot happen.
 */
export function CategoryCreate({
  eventId,
  tiers,
  className,
}: {
  eventId: number;
  tiers: readonly PointTier[];
  className?: string;
}) {
  const nameId = useId();
  const [name, setName] = useState('');
  const [tierId, setTierId] = useState<string>('');
  const [active, setActive] = useState(true);
  const [requiresNomineeName, setRequiresNomineeName] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (trimmed === '') {
        setMessage('Give the category a name.');
        return;
      }
      setMessage(null);
      startTransition(async () => {
        const result = await createCategory({
          eventId,
          name: trimmed,
          pointsId: tierId === '' ? null : Number(tierId),
          active,
          requiresNomineeName,
        });
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setName('');
        setTierId('');
        setActive(true);
        setRequiresNomineeName(false);
        setMessage(`${trimmed} added`);
      });
    },
    [eventId, name, tierId, active, requiresNomineeName],
  );

  return (
    <form
      onSubmit={submit}
      className={cn(
        'border-border-rule flex flex-wrap items-end gap-3 border-l-2 pl-4',
        className,
      )}
    >
      <label className="flex flex-col gap-1">
        <span id={nameId} className="text-text-dim text-xs">
          New category
        </span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-labelledby={nameId}
          placeholder="Best Picture"
          className="border-border-rule bg-bg-raised text-text-primary min-h-11 border px-3 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-text-dim text-xs">Worth</span>
        <select
          value={tierId}
          onChange={(event) => setTierId(event.target.value)}
          className="border-border-rule bg-bg-raised text-text-primary min-h-11 border px-2 text-sm"
        >
          <option value="">No tier yet</option>
          {tiers.map((tier) => (
            <option key={tier.id} value={tier.id}>
              {tier.level} · {tier.points} pts
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-h-11 items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={requiresNomineeName}
          onChange={(event) => setRequiresNomineeName(event.target.checked)}
        />
        <span className="text-text-dim">Nominates a person</span>
      </label>

      <label className="flex min-h-11 items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />
        <span className="text-text-dim">Active</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="border-border-rule text-text-primary hover:bg-bg-raised min-h-11 border px-4 text-sm disabled:opacity-60"
      >
        {pending ? 'Adding…' : 'Add category'}
      </button>

      <p aria-live="polite" className="text-text-secondary min-h-5 w-full text-xs">
        {message ?? ''}
      </p>
    </form>
  );
}
