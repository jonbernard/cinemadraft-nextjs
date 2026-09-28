'use client';

import { useCallback, useState, useTransition } from 'react';
import { completeDraft } from '@/actions/leagues/manage-league';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';

/**
 * 🔴 The draft's end state, on both screens that manage a season.
 *
 * `completeDraft` shipped in P10.T17 and no UI called it until P19.T1 put this
 * on season setup. The owner then reported it missing, because they run the
 * draft from the console and never go back to setup mid-call — so it is on
 * both now, and it is one component so the two cannot drift: the same gate,
 * the same confirm, the same action.
 *
 * **The gate lives here, not in the callers.** Owner-only and only while the
 * season is `active` (D130's status for that year): a pending draft has not
 * begun and a finished one has nothing more to finish. Both pages already 404
 * a non-owner and the action re-checks (`authorizeLeague`), so `canManage` is
 * the third line, not the only one.
 *
 * Confirms, like starting does. The league stops watching when this is
 * pressed, which is not something a mis-click should be able to say. When
 * seats are still behind the longest one (`unfilled`, D34: there is no stored
 * roster size) the confirm says how many; finishing early stays allowed.
 *
 * The `Button` primitive in its default carmine (D69): carmine is submit and
 * destructive, brass is awards, and ending a draft is neither an award nor
 * something to dress as one.
 *
 * The action revalidates the league layout, which both pages sit under, so a
 * success re-renders the page it was pressed on in its finished state. With
 * no `onDone` the result is announced here instead.
 */
export function FinishDraftButton({
  leagueId,
  year,
  status,
  canManage,
  unfilled = 0,
  disabled = false,
  onDone,
}: {
  leagueId: number;
  year: number;
  status: string | null;
  canManage: boolean;
  unfilled?: number;
  disabled?: boolean;
  onDone?: (message: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const report = onDone ?? setMessage;

  const finish = useCallback(async () => {
    const remaining =
      unfilled > 0
        ? ` ${unfilled} ${unfilled === 1 ? 'pick is' : 'picks are'} still unfilled.`
        : '';
    if (
      !(await confirm(
        `Finish the draft? The league will be told it is over.${remaining}`,
        'Finish the draft',
      ))
    ) {
      return;
    }
    startTransition(async () => {
      const result = await completeDraft({ leagueId, year });
      report(result.ok ? 'The draft is finished' : result.message);
    });
  }, [leagueId, year, unfilled, report, confirm]);

  if (!canManage || status !== 'active') return null;

  return (
    <>
      {dialog}
      <Button
        type="button"
        disabled={disabled || pending}
        onClick={finish}
        sx={{ width: 'fit-content', minHeight: 44 }}
      >
        Finish the draft
      </Button>
      {onDone ? null : (
        <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
          {message ?? ''}
        </p>
      )}
    </>
  );
}
