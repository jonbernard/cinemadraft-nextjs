import { PosterFrame, type PosterStatus } from '@/components/ui/PosterFrame';
import { SectionHead } from '@/components/ui/SectionHead';

/**
 * Structurally what `lib/services/live.ts` produces, and declared here rather
 * than imported: that module reaches repositories and the db client, and
 * `components/` may not depend on it (D33). A type-only import would erase at
 * build time but still points the dependency the wrong way. Same pattern as
 * `SeasonStepper`'s `SeasonPhase`.
 */
export type LiveFilm = {
  movieId: number;
  title: string;
  posterUrl: string | null;
  /** Points earned at THIS show only, not the season total. */
  earned: number;
  /**
   * 🔴 `'none'` is unreachable on this page — a film with no line at this show
   * is dropped by the service — and is kept in the union anyway so the type
   * matches `PosterFrame`'s `PosterStatus` and this file does not need a
   * narrower one. Do not "tidy" it away.
   */
  status: PosterStatus;
};

export type LiveSeat = {
  draftId: number;
  name: string;
  isViewer: boolean;
  /** The sum of `films[].earned` — this seat's take from this show. */
  earned: number;
  /** Only the seat's films that are in play here. A seat may have none. */
  films: LiveFilm[];
};

export type LiveLeague = {
  id: number;
  name: string | null;
  /** The league's whole take from this show. */
  total: number;
  seats: LiveSeat[];
};

/**
 * One league's seats at one show, with what each has earned there (P17.T16).
 *
 * 🔴 One league, not a list, since P14.T2: the page shows the league the URL
 * pinned or the reader's own, and a picker is how you get to another.
 *
 * A Server Component: no state, no effects, nothing to hydrate.
 *
 * 🔴 **Order is the service's, and this must not re-sort.** The seats arrive
 * ranked by what they took tonight, and that ranking is the meaning of the
 * page — the same rule `RosterStrip`'s docstring states for draft order.
 *
 * No `round`: a film's draft position is not what this page is about. No
 * `priority`: this is not the page's LCP, and marking a whole shelf is worse
 * than marking nothing (see `PosterFrame.priority`).
 *
 * 🔴 It does not use `Shelf`. A shelf always renders its `<ul>`, and a seat
 * with nothing in play here needs words instead of an empty strip — which is a
 * real and common state, since most seats are not in most of the twelve shows.
 * The scroll behaviour is the same four utilities either way.
 */
export function LiveBoard({ league }: { league: LiveLeague }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHead as="h3" name right={String(league.total)}>
        {league.name ?? 'Your league'}
      </SectionHead>

      {league.seats.map((seat) => (
        <div key={seat.draftId} className="min-w-0">
          <SectionHead
            as="h4"
            name
            eyebrow={seat.isViewer ? 'Your seat' : undefined}
            right={String(seat.earned)}
          >
            {seat.name}
          </SectionHead>

          {seat.films.length === 0 ? (
            <p className="text-text-secondary text-sm">Nothing in play here.</p>
          ) : (
            <ul className="snap-x scroll-px-1 flex gap-3 overflow-x-auto pb-2 [&>li]:snap-start [&>li]:shrink-0">
              {seat.films.map((film) => (
                <li key={film.movieId} className="w-40">
                  <PosterFrame
                    title={film.title}
                    posterUrl={film.posterUrl}
                    points={film.earned}
                    // This film's share of what the seat took tonight —
                    // the same contribution bar the roster strip draws,
                    // against tonight's total rather than the season's.
                    share={seat.earned > 0 ? film.earned / seat.earned : 0}
                    status={film.status}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
