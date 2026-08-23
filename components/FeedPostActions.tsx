'use client';

import { useCallback, useState, useTransition } from 'react';

import type { ActionResult } from '@/actions/result';

export type DeleteFeedItem = (input: { id: number }) => Promise<ActionResult<null>>;

/**
 * Remove one of your own posts (P10.T42).
 *
 * The source hid this behind a kebab menu holding a single item; a menu that
 * only ever has one entry costs a tap and a focus trap to say "Delete".
 *
 * `label` is the whole accessible name, not a fragment to interpolate: an
 * undated post has no phrase to slot into "Delete your post from …".
 */
export function FeedPostActions({
  id,
  label,
  onDelete,
}: {
  id: number;
  label: string;
  onDelete: DeleteFeedItem;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = useCallback(() => {
    setError(null);
    startTransition(async () => {
      const result = await onDelete({ id });
      if (!result.ok) setError(result.message);
    });
  }, [id, onDelete]);

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label={label}
        className="text-text-dim hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 min-w-11 items-center justify-center rounded-sm text-sm focus-visible:outline-2"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
      <p aria-live="polite" className="text-text-secondary text-xs">
        {error}
      </p>
    </div>
  );
}
