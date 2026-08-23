'use client';

import { useCallback, useState, useTransition } from 'react';

import { setActiveYear } from '@/actions/admin/set-active-year';
import { cn } from '@/lib/utils/cn';

export type SeasonRow = {
  year: number;
  isActive: boolean;
};

/**
 * Switch the active season (T48).
 *
 * The source app read `REACT_APP_ACTIVE_YEAR` at build time, so changing
 * seasons meant a redeploy (D22). This is the control that replaces it: pick
 * a year, press the button, and — because `setActiveYear` calls
 * `revalidatePath('/', 'layout')` — nearly every page in the app re-scopes to
 * it without a reload.
 *
 * No confirmation dialog. Unlike relinking an identity or deleting a category,
 * this is fully reversible by pressing another year's button, and the source
 * app changed it constantly during a season's turnover.
 */
export function SeasonControl({
  seasons,
  className,
}: {
  seasons: readonly SeasonRow[];
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingYear, setPendingYear] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const activate = useCallback((year: number) => {
    setMessage(null);
    setPendingYear(year);
    startTransition(async () => {
      const result = await setActiveYear(year);
      setMessage(result.ok ? `${year} is now the active season` : result.message);
      setPendingYear(null);
    });
  }, []);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ul className="flex flex-col">
        {seasons.map((season) => (
          <li
            key={season.year}
            className="border-border-rule flex items-center justify-between gap-3 border-b py-3 text-sm last:border-b-0"
          >
            <span className="text-text-primary tabular font-mono">{season.year}</span>
            {season.isActive ? (
              <span className="text-accent-text text-xs">Active</span>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => activate(season.year)}
                className="border-border-rule text-text-primary hover:bg-bg-raised min-h-11 border px-4 text-xs disabled:opacity-60"
              >
                {pending && pendingYear === season.year ? 'Activating…' : 'Make active'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
        {message ?? ''}
      </p>
    </div>
  );
}
