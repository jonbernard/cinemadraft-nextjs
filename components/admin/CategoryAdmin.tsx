'use client';

import { useCallback, useState, useTransition } from 'react';

import { attachNominee } from '@/actions/awards/attach-nominee';
import { deleteCategory } from '@/actions/awards/delete-category';
import { focusAward } from '@/actions/awards/focus-award';
import { removeNominee } from '@/actions/awards/remove-nominee';
import { setWinner } from '@/actions/awards/set-winner';
import { findFilmsAction } from '@/actions/search/find-films';
import { FilmSearch, type SearchedFilm } from '@/components/draft/FilmSearch';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import { cn } from '@/lib/utils/cn';

export type AdminNominee = {
  nominationId: number;
  movieId: number;
  title: string;
  isWinner: boolean;
};

/**
 * The controls that enter a category's nominations and its winner (§12).
 *
 * 🔴 **This is where the scoring inputs come from.** A nomination pays the
 * category's points to whoever drafted the film, and a win pays them again
 * (D41), so a mistake here moves every league's standings at once. Every
 * action behind these controls requires an admin, and the refusals are tested
 * — the source app's equivalent endpoints were open to anyone with curl
 * (`PARITY.md` bug 1).
 *
 * The controls are hidden from non-admins for tidiness, **not** for security.
 * Hiding a button is not a permission; the gate is on the server.
 *
 * Winner selection is a set of buttons over the existing nominees rather than
 * a second search, because a winner is always one of them — the server refuses
 * anything else, and offering a free search would invite the refusal.
 */
export function CategoryAdmin({
  awardId,
  categoryName,
  year,
  nominees,
  requiresNomineeName,
  onScreen,
  className,
}: {
  awardId: number;
  /** For the delete confirmation — naming what is about to go, not just "this". */
  categoryName: string;
  year: number;
  nominees: readonly AdminNominee[];
  requiresNomineeName: boolean;
  /** This is the category every watcher's screen is currently showing (P10.T32). */
  onScreen: boolean;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [nomineeName, setNomineeName] = useState('');
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const search = useCallback(
    async (query: string): Promise<SearchedFilm[]> => {
      const result = await findFilmsAction({
        query,
        // Year-scoped and nomination-aware: a film already nominated this
        // season is far more likely to be the one being typed (§10).
        context: { kind: 'award-admin', year },
      });
      return result.ok ? result.data : [];
    },
    [year],
  );

  const attach = useCallback(
    (film: SearchedFilm) => {
      setMessage(null);
      startTransition(async () => {
        // Either identifier is accepted. A film TMDB knows and this app has
        // never cached gets ingested by the action — which is the normal case
        // during nominations season, when the films being entered are new.
        const result = await attachNominee({
          awardId,
          ...(film.id == null
            ? { tmdbId: film.tmdbId ?? undefined }
            : { movieId: film.id }),
          year,
          ...(nomineeName.trim() === '' ? {} : { detailName: nomineeName.trim() }),
        });

        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setNomineeName('');
        setResetSignal((signal) => signal + 1);
        setMessage(`${film.title} nominated`);
      });
    },
    [awardId, year, nomineeName],
  );

  const markWinner = useCallback(
    (nominee: AdminNominee) => {
      setMessage(null);
      startTransition(async () => {
        // Clicking the current winner clears it — the announcement was
        // misheard and for a moment nobody has won.
        const result = await setWinner({
          awardId,
          year,
          movieId: nominee.isWinner ? null : nominee.movieId,
        });
        if (!result.ok) setMessage(result.message);
      });
    },
    [awardId, year],
  );

  const putOnScreen = useCallback(() => {
    // Pressing the one that is already up takes it down — there is one
    // selection per show, and "nothing on screen" is a state an admin needs
    // between announcements.
    setMessage(null);
    startTransition(async () => {
      const result = await focusAward({ awardId, on: !onScreen });
      if (!result.ok) setMessage(result.message);
    });
  }, [awardId, onScreen]);

  const remove = useCallback((nominee: AdminNominee) => {
    setMessage(null);
    startTransition(async () => {
      const result = await removeNominee(nominee.nominationId);
      if (!result.ok) setMessage(result.message);
    });
  }, []);

  const removeCategory = useCallback(async () => {
    // 🔴 Deleting a category never cascades — a refusal names how many
    // nominations are in the way, and the confirmation says so up front so
    // the admin is not surprised by it.
    if (
      !(await confirm(
        `Delete "${categoryName}"? This refuses if any films are still nominated in it — remove those first.`,
        'Delete',
      ))
    ) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await deleteCategory(awardId);
      if (!result.ok) setMessage(result.message);
    });
  }, [awardId, categoryName, confirm]);

  return (
    <div
      className={cn('border-border-rule flex flex-col gap-3 border-l-2 pl-4', className)}
    >
      {dialog}
      {requiresNomineeName ? (
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs">Person nominated</span>
          <input
            type="text"
            value={nomineeName}
            onChange={(event) => setNomineeName(event.target.value)}
            placeholder="Required for this category"
            className="border-border-rule bg-bg-surface text-text-primary w-full border px-3 py-2 text-sm"
          />
        </label>
      ) : null}

      <FilmSearch
        onSearch={search}
        onSelect={attach}
        label="Nominate a film"
        busy={pending}
        debounceMs={250}
        resetSignal={resetSignal}
      />

      <p aria-live="polite" className="text-text-secondary min-h-5 text-xs">
        {pending ? 'Saving…' : (message ?? '')}
      </p>

      {nominees.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {nominees.map((nominee) => (
            <NomineeControls
              key={nominee.nominationId}
              nominee={nominee}
              disabled={pending}
              onMarkWinner={markWinner}
              onRemove={remove}
            />
          ))}
        </ul>
      ) : null}

      {/* 🔴 Carmine, not brass. Brass is an award outcome (D85/D99); this is
          "live / now", and it changes no scoring input at all. Named in words
          as well as coloured, and `aria-pressed` carries the state to a
          reader who is not looking at the colour. */}
      <button
        type="button"
        onClick={putOnScreen}
        disabled={pending}
        aria-pressed={onScreen}
        className={cn(
          'focus-visible:outline-accent-fill min-h-11 w-fit rounded-sm px-3 text-sm disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2',
          onScreen
            ? 'bg-accent-fill font-medium text-white'
            : 'border-border-rule text-text-primary border',
        )}
      >
        {onScreen ? 'On screen' : 'Put on screen'}
      </button>

      <button
        type="button"
        onClick={removeCategory}
        disabled={pending}
        className="text-text-dim hover:text-text-primary w-fit text-xs underline disabled:opacity-60"
      >
        Delete category
      </button>
    </div>
  );
}

function NomineeControls({
  nominee,
  disabled,
  onMarkWinner,
  onRemove,
}: {
  nominee: AdminNominee;
  disabled: boolean;
  onMarkWinner: (nominee: AdminNominee) => void;
  onRemove: (nominee: AdminNominee) => void;
}) {
  const mark = useCallback(() => onMarkWinner(nominee), [onMarkWinner, nominee]);
  const remove = useCallback(() => onRemove(nominee), [onRemove, nominee]);

  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-text-primary flex flex-1 flex-wrap items-center gap-2">
        {nominee.title}
        {/* Named, not signalled by colour alone. */}
        {nominee.isWinner ? <StatusChip tone="brass">Winner</StatusChip> : null}
      </span>
      <button
        type="button"
        onClick={mark}
        disabled={disabled}
        className="text-accent-text text-xs underline"
      >
        {nominee.isWinner ? 'Clear winner' : 'Mark winner'}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={disabled}
        className="text-text-dim text-xs underline"
      >
        Remove
      </button>
    </li>
  );
}
