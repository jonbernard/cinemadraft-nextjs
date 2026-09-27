'use client';

import { type ReactNode, useCallback, useState, useTransition } from 'react';

import { attachNominee } from '@/actions/awards/attach-nominee';
import { deleteCategory } from '@/actions/awards/delete-category';
import { type FilmPerson, filmPeopleAction } from '@/actions/awards/film-people';
import { focusAward } from '@/actions/awards/focus-award';
import { removeNominee } from '@/actions/awards/remove-nominee';
import { setWinner } from '@/actions/awards/set-winner';
import { findFilmsAction } from '@/actions/search/find-films';
import { PersonPicker } from '@/components/admin/PersonPicker';
import { type GridNominee, NomineeGrid } from '@/components/awards/NomineeGrid';
import { FilmSearch, type SearchedFilm } from '@/components/draft/FilmSearch';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { RemoteImage } from '@/components/ui/RemoteImage';
import { cn } from '@/lib/utils/cn';

export type AdminNominee = GridNominee & {
  movieId: number;
  /** TMDB's person id, when the nomination names someone. */
  detailId: number | null;
};

/** The focus ring every control here shares — the app's own, not MUI's ripple. */
const FOCUS =
  'focus-visible:outline-accent-fill focus-visible:outline-2 focus-visible:outline-offset-2';

/** One hover for every quiet button here: a surface step, never a tint of red. */
const QUIET_HOVER = { '&:hover': { backgroundColor: 'var(--color-bg-surface)' } };

/** Who a nomination is for, in words: "Sean Penn, One Battle After Another". */
function nomineeName(nominee: { title: string; detailName: string | null }): string {
  return nominee.detailName ? `${nominee.detailName}, ${nominee.title}` : nominee.title;
}

/**
 * Mirrors the server's duplicate rule (`attach-nominee.ts`), so a person who is
 * already up for this film is marked in the picker rather than refused after
 * the click. The server still decides.
 */
function alreadyNominated(
  nominees: readonly AdminNominee[],
  film: SearchedFilm,
  person: FilmPerson,
): boolean {
  return nominees.some(
    (nominee) =>
      film.id != null &&
      nominee.movieId === film.id &&
      (nominee.detailId != null
        ? nominee.detailId === person.id
        : nominee.detailName?.trim().toLowerCase() === person.name.trim().toLowerCase()),
  );
}

/**
 * A category's nominees and every control that changes them (§12).
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
 * The admin sees the same poster grid a reader does, with the controls on each
 * poster. There used to be a second, text-only list of the same nominees under
 * the form, which named the film only — so *One Battle After Another*'s two
 * nominations were two identical rows, one for Benicio del Toro and one for
 * Sean Penn, and nothing said which was which. The poster's person line does.
 *
 * Nominating is film first, then — where the category names someone — the
 * person, chosen from that film's credits, as the source app did it.
 */
export function CategoryAdmin({
  awardId,
  categoryName,
  year,
  nominees,
  requiresNomineeName,
  onScreen,
  children,
  className,
}: {
  awardId: number;
  /** For the confirmations — naming what is about to go, not just "this". */
  categoryName: string;
  year: number;
  nominees: readonly AdminNominee[];
  requiresNomineeName: boolean;
  /** This is the category every watcher's screen is currently showing (P10.T32). */
  onScreen: boolean;
  /** The category's status chips, which share a row with "Put on screen". */
  children?: ReactNode;
  className?: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  // Person categories only: the film chosen, and its credits once they land.
  const [film, setFilm] = useState<SearchedFilm | null>(null);
  const [people, setPeople] = useState<readonly FilmPerson[] | null>(null);
  // Which control the pending transition belongs to, so the spinner is on the
  // button that was pressed rather than on all of them.
  const [acting, setActing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();

  const run = useCallback((key: string, work: () => Promise<void>) => {
    setMessage(null);
    setActing(key);
    startTransition(async () => {
      await work();
      setActing(null);
    });
  }, []);

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

  const backToFilm = useCallback(() => {
    setFilm(null);
    setPeople(null);
    setResetSignal((signal) => signal + 1);
  }, []);

  const attach = useCallback(
    (chosen: SearchedFilm, person?: FilmPerson) => {
      run('attach', async () => {
        // Either identifier is accepted. A film TMDB knows and this app has
        // never cached gets ingested by the action — which is the normal case
        // during nominations season, when the films being entered are new.
        const result = await attachNominee({
          awardId,
          ...(chosen.id == null
            ? { tmdbId: chosen.tmdbId ?? undefined }
            : { movieId: chosen.id }),
          year,
          ...(person
            ? {
                detailName: person.name,
                detailId: person.id,
                // A crew credit has no character, and storing a cameo's role
                // against a directing nomination is the source's bug.
                ...(person.character ? { detailCharacter: person.character } : {}),
              }
            : {}),
        });

        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        backToFilm();
        setMessage(
          person
            ? `${person.name} nominated for ${chosen.title}`
            : `${chosen.title} nominated`,
        );
      });
    },
    [awardId, year, run, backToFilm],
  );

  const chooseFilm = useCallback(
    (chosen: SearchedFilm) => {
      if (!requiresNomineeName) {
        attach(chosen);
        return;
      }
      setFilm(chosen);
      setPeople(null);
      if (!chosen.tmdbId) {
        setMessage(
          `TMDB has no record of ${chosen.title}, so it has no credits to choose from`,
        );
        return;
      }
      const tmdbId = chosen.tmdbId;
      run('people', async () => {
        const result = await filmPeopleAction(tmdbId);
        if (result.ok) setPeople(result.data);
        else setMessage(result.message);
      });
    },
    [requiresNomineeName, attach, run],
  );

  const markWinner = useCallback(
    (nominee: AdminNominee) => {
      run(`winner-${nominee.nominationId}`, async () => {
        // Clicking the current winner clears it — the announcement was
        // misheard and for a moment nobody has won. By nomination, not film:
        // one film can hold two nominations here, and only one of them won.
        const result = await setWinner({
          awardId,
          year,
          nominationId: nominee.isWinner ? null : nominee.nominationId,
        });
        if (!result.ok) setMessage(result.message);
      });
    },
    [awardId, year, run],
  );

  const remove = useCallback(
    async (nominee: AdminNominee) => {
      // 🔴 Confirmed, because it is one click from "Mark winner" on the same
      // poster and it takes the film's points for this category away from
      // whoever drafted it — and its win, if it had one.
      const win = nominee.isWinner ? ' Its win goes with it.' : '';
      if (
        !(await confirm(
          `Remove ${nomineeName(nominee)} from ${categoryName}?${win}`,
          'Remove',
        ))
      ) {
        return;
      }
      run(`remove-${nominee.nominationId}`, async () => {
        const result = await removeNominee(nominee.nominationId);
        if (!result.ok) setMessage(result.message);
      });
    },
    [categoryName, confirm, run],
  );

  const putOnScreen = useCallback(() => {
    // Pressing the one that is already up takes it down — there is one
    // selection per show, and "nothing on screen" is a state an admin needs
    // between announcements.
    run('screen', async () => {
      const result = await focusAward({ awardId, on: !onScreen });
      if (!result.ok) setMessage(result.message);
    });
  }, [awardId, onScreen, run]);

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
    run('delete', async () => {
      const result = await deleteCategory(awardId);
      if (!result.ok) setMessage(result.message);
    });
  }, [awardId, categoryName, confirm, run]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {dialog}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">{children}</div>

        {/* 🔴 Carmine, not brass. Brass is an award outcome (D85/D99); this is
            "live / now", and it changes no scoring input at all. Named in words
            as well as coloured, and `aria-pressed` carries the state to a
            reader who is not looking at the colour. Up here beside the chips
            because on the night it is pressed before the envelope is opened,
            and the envelope is the grid directly below. */}
        <Button
          onClick={putOnScreen}
          disabled={pending}
          loading={acting === 'screen'}
          aria-pressed={onScreen}
          variant={onScreen ? 'contained' : 'outlined'}
          className={cn('min-h-11', FOCUS)}
        >
          {onScreen ? 'On screen' : 'Put on screen'}
        </Button>
      </div>

      <NomineeGrid
        nominees={nominees}
        actions={(nominee) => (
          <NomineeControls
            nominee={nominee}
            disabled={pending}
            acting={acting}
            onMarkWinner={markWinner}
            onRemove={remove}
          />
        )}
      />

      <p aria-live="polite" className="text-text-secondary min-h-5 text-sm">
        {pending && acting === 'people' ? 'Loading the cast and crew…' : null}
        {pending && acting !== 'people' ? 'Saving…' : null}
        {pending ? null : (message ?? '')}
      </p>

      {/* Capped: a title field 1,000px wide is a long way to read back what
          was typed, and the result rows under it are as wide as it is. */}
      {film ? (
        <div className="flex max-w-xl flex-col gap-4">
          <div className="flex items-center gap-3">
            {film.posterUrl ? (
              <RemoteImage
                src={film.posterUrl}
                alt=""
                width={32}
                height={48}
                className="h-12 w-8 rounded-sm object-cover"
              />
            ) : null}
            <span className="text-text-primary flex-1 font-serif text-sm">
              {film.title}
              {film.year ? (
                <span className="text-text-secondary tabular font-mono">
                  {' '}
                  {film.year}
                </span>
              ) : null}
            </span>
            <Button
              variant="text"
              onClick={backToFilm}
              disabled={pending && acting === 'attach'}
              className={cn('min-h-11', FOCUS)}
              sx={{ color: 'var(--color-text-secondary)', ...QUIET_HOVER }}
            >
              Change film
            </Button>
          </div>

          {people ? (
            <PersonPicker
              people={people}
              onSelect={(person) => attach(film, person)}
              onCancel={backToFilm}
              isUnavailable={(person) => alreadyNominated(nominees, film, person)}
              busy={pending}
              autoFocus
            />
          ) : null}
        </div>
      ) : (
        <FilmSearch
          onSearch={search}
          onSelect={chooseFilm}
          label={
            requiresNomineeName ? 'Nominate a film, then its person' : 'Nominate a film'
          }
          busy={pending}
          debounceMs={250}
          resetSignal={resetSignal}
          className="max-w-xl"
        />
      )}

      <Button
        variant="text"
        onClick={removeCategory}
        disabled={pending}
        loading={acting === 'delete'}
        // Pulled out by its own padding so the word lines up with the field
        // above it rather than 8px inside it.
        className={cn('-ml-2 min-h-11 self-start', FOCUS)}
        sx={QUIET_HOVER}
      >
        Delete category
      </Button>
    </div>
  );
}

/**
 * The two controls under one poster.
 *
 * The visible label is the act; the accessible name adds who it is for, so a
 * screen reader walking five "Mark winner" buttons hears five different
 * nominees — and a film nominated twice is two different names, not one name
 * said twice. The visible words start the name, as WCAG 2.5.3 asks.
 */
function NomineeControls({
  nominee,
  disabled,
  acting,
  onMarkWinner,
  onRemove,
}: {
  nominee: AdminNominee;
  disabled: boolean;
  acting: string | null;
  onMarkWinner: (nominee: AdminNominee) => void;
  onRemove: (nominee: AdminNominee) => void;
}) {
  const who = <span className="sr-only">: {nomineeName(nominee)}</span>;

  return (
    <div className="mt-auto flex flex-wrap gap-1 pt-2">
      {/* Brass: this act decides an award outcome, which is brass's one job
          (D69/D99). Outlined rather than filled, because a category shows
          five of these at once and a wall of brass fills would outshout the
          one "Winner" chip it exists to produce. */}
      <Button
        variant="outlined"
        size="small"
        onClick={() => onMarkWinner(nominee)}
        disabled={disabled}
        loading={acting === `winner-${nominee.nominationId}`}
        className={cn('min-h-11 grow', FOCUS)}
        sx={
          nominee.isWinner
            ? {
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-border-rule)',
                ...QUIET_HOVER,
              }
            : {
                color: 'var(--color-brass-text)',
                borderColor: 'var(--color-brass-text)',
                ...QUIET_HOVER,
              }
        }
      >
        {nominee.isWinner ? 'Clear winner' : 'Mark winner'}
        {who}
      </Button>
      <Button
        variant="text"
        size="small"
        onClick={() => onRemove(nominee)}
        disabled={disabled}
        loading={acting === `remove-${nominee.nominationId}`}
        className={cn('min-h-11 grow', FOCUS)}
        sx={QUIET_HOVER}
      >
        Remove
        {who}
      </Button>
    </div>
  );
}
