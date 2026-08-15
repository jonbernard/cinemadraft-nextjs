'use client';

import { useCallback, useState, useTransition } from 'react';

import { attachNominee } from '@/actions/awards/attach-nominee';
import { removeNominee } from '@/actions/awards/remove-nominee';
import { setWinner } from '@/actions/awards/set-winner';
import { findFilmsAction } from '@/actions/search/find-films';
import { FilmSearch, type SearchedFilm } from '@/components/FilmSearch';
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
  year,
  nominees,
  requiresNomineeName,
  className,
}: {
  awardId: number;
  year: number;
  nominees: readonly AdminNominee[];
  requiresNomineeName: boolean;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [nomineeName, setNomineeName] = useState('');
  const [pending, startTransition] = useTransition();

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

  const remove = useCallback((nominee: AdminNominee) => {
    setMessage(null);
    startTransition(async () => {
      const result = await removeNominee(nominee.nominationId);
      if (!result.ok) setMessage(result.message);
    });
  }, []);

  return (
    <div
      className={cn('border-border-rule flex flex-col gap-3 border-l-2 pl-4', className)}
    >
      {requiresNomineeName ? (
        <label className="flex flex-col gap-1">
          <span className="text-text-dim text-xs uppercase tracking-wide">
            Person nominated
          </span>
          <input
            type="text"
            value={nomineeName}
            onChange={(event) => setNomineeName(event.target.value)}
            placeholder="Required for this category"
            className="border-border-rule bg-bg-raised text-text-primary w-full border px-3 py-2 text-sm"
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
      <span className="text-text-primary flex-1">
        {nominee.title}
        {/* Named, not signalled by colour alone. */}
        {nominee.isWinner ? <span className="text-accent-text"> · winner</span> : null}
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
