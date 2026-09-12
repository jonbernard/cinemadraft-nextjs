'use client';

import { Fragment, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/** One award show, as a column. Re-declared: `components/` may not import from `lib/services/` (D33). */
export type LeaderboardEventView = { abbreviation: string; name: string };

export type LeaderboardRowView = {
  movieId: number;
  title: string;
  events: Record<string, number>;
  total: number;
};

export type LeaderboardView = {
  year: number;
  events: LeaderboardEventView[];
  rows: LeaderboardRowView[];
};

/** How many rows the table opens with, and how many each press reveals. */
const PAGE = 10;

/**
 * The season leaderboard grid (P10.T4, P15.T1): one row per nominated film,
 * one column per award show, a Total column, sorted by total descending.
 *
 * 🔴 **Ten rows, then a reveal.** A full season is every film anybody was
 * nominated for — dozens of rows above the fold on the app's front page. The
 * data all arrives with the page, so the button reveals rather than fetches:
 * no endpoint, no loading state, no second query.
 *
 * 🔴 **Mobile is Film + Total, not a horizontal scroll (D79, amending D49).**
 * D49 kept every column and scrolled the table sideways. Measured on a 390px
 * phone that puts Total off screen at every width — the reader gets a list of
 * titles and has to scroll to reach the one number the section reports. The
 * per-show columns stay `hidden lg:table-cell`, so nothing changes at `lg`.
 * The columns are hidden, not removed: the markup and its `<caption>` are
 * intact, so a screen reader still reads the whole grid.
 *
 * 🔴 **The columns are named in a legend, not in a `title` (P17.T4).** Each
 * per-show header used to carry `title={event.name}`. `title` never fires on a
 * touch screen and is unreliable from a keyboard, so on every device but a
 * mouse these were unlabelled three-letter codes — and the twelve award bodies
 * are the app's primary vocabulary, not something a reader arrives knowing.
 * Twelve full names will not fit twelve columns at any width, so the mapping
 * goes underneath, carrying the same visibility as the columns it explains.
 *
 * 🔴 **The film column sticks, and the shows scroll, at `lg` and up only
 * (P17.T4). D79 is upheld, not amended.** Below `lg` there is still no
 * `min-width` and no scroll, for D79's own reason. At `lg` the per-show
 * columns return, a range D79 never spoke about, and the table owns its own
 * overflow there so that it can never hand it to the document. 🔴 Dormant as
 * measured: with twelve shows at 1024px the table is 992px inside a 992px
 * wrapper, so nothing scrolls today. See the comment on the container.
 *
 * 🔴 **Below `lg` the film title is a disclosure (P17.T4).** Hiding the
 * per-show columns left the reader a total with no account of where it came
 * from, on the device most of them use. Opening a row inserts a list of the
 * shows that film actually scored at, by name. At `lg` and up the columns are
 * on screen and a disclosure would reveal what is already visible.
 */
export function LeaderboardTable({
  leaderboard,
  className,
}: {
  leaderboard: LeaderboardView;
  className?: string;
}) {
  const [shown, setShown] = useState(PAGE);

  /**
   * Which films have their breakdown open.
   *
   * A Set rather than a single id: two readers comparing two films is the
   * normal use, and closing one to open another is a fight with the reader.
   */
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  const toggle = (movieId: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(movieId)) next.add(movieId);
      return next;
    });

  if (leaderboard.rows.length === 0) {
    return (
      <p className={cn('text-text-secondary text-sm', className)}>
        No nominations for {leaderboard.year} yet.
      </p>
    );
  }

  const visible = leaderboard.rows.slice(0, shown);
  const remaining = leaderboard.rows.length - visible.length;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/*
        🔴 `lg:overflow-x-auto`, not `overflow-x-auto`. D79 removed the scroll
        *below* `lg` and that stays removed: on a phone it put Total off screen
        at every width, which is the one number this section exists to report.
        D79 said nothing about `lg`, where the per-show columns return. The
        scroll is restored exactly there, and the film column pins inside it,
        so that when fourteen columns do not fit the table scrolls and the
        document does not.

        🔴 **Measured 2026-09-12 against a production build, and narrower than
        the review claimed:** with today's twelve shows the table does *not*
        overflow at 1024 — the wrapper's `scrollWidth` and `clientWidth` are
        both 992. So this container and the sticky cell are dormant at every
        width the app has today. They are here because a table that can grow a
        column per award show has to own its own overflow rather than hand it
        to the document; **no `min-width` is set**, deliberately, because any
        floor below 992 can never bind at `lg` and one above it would
        manufacture the scroll rather than survive it.
      */}
      <div className="lg:overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Season leaderboard by award show, {leaderboard.year}
          </caption>
          <thead>
            <tr className="border-border-rule border-b">
              {/* 🔴 The sticky cell paints its own ground or the scrolled
                columns show through it. `bg-bg-surface` is the tone of the
                `Panel as="main"` this table sits directly inside
                (`components/Panel.tsx` defaults to `surface`) — not a guess,
                and it must be re-checked if the table is ever moved into a
                `raised` panel. Verified in **both** schemes: a background
                chosen against the dark ground is exactly the kind of thing
                that is invisibly wrong in light. */}
              <th
                scope="col"
                className="text-text-dim bg-bg-surface py-2 pr-3 text-left text-xs font-normal lg:sticky lg:left-0 lg:z-10"
              >
                Film
              </th>
              {leaderboard.events.map((event) => (
                <th
                  key={event.abbreviation}
                  scope="col"
                  className="text-text-dim hidden py-2 px-2 text-right text-xs font-normal lg:table-cell"
                >
                  {event.abbreviation.toUpperCase()}
                </th>
              ))}
              <th
                scope="col"
                className="text-text-dim py-2 pl-3 text-right text-xs font-normal"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <Fragment key={row.movieId}>
                <tr className="border-border-rule border-b">
                  <th
                    scope="row"
                    className="text-text-primary bg-bg-surface py-2 pr-3 text-left font-normal lg:sticky lg:left-0 lg:z-10"
                  >
                    {/* 🔴 Below `lg` the per-show columns are hidden (D79), which
                      left the reader a total with no account of where it came
                      from — on the device most of them use. The title opens the
                      breakdown there; at `lg` and up the columns are on screen
                      and a disclosure would be a control that reveals what is
                      already visible. */}
                    <button
                      type="button"
                      onClick={() => toggle(row.movieId)}
                      aria-expanded={open.has(row.movieId)}
                      aria-controls={`breakdown-${row.movieId}`}
                      className="focus-visible:outline-accent-fill flex min-h-11 items-center gap-2 text-left focus-visible:outline-2 lg:hidden"
                    >
                      {row.title}
                      <span aria-hidden="true" className="text-text-dim text-xs">
                        {open.has(row.movieId) ? '▾' : '▸'}
                      </span>
                    </button>
                    <span className="hidden lg:inline">{row.title}</span>
                  </th>
                  {leaderboard.events.map((event) => (
                    <td
                      key={event.abbreviation}
                      className="text-text-secondary tabular hidden py-2 px-2 text-right font-mono lg:table-cell"
                    >
                      {row.events[event.abbreviation] ?? 0}
                    </td>
                  ))}
                  <td className="text-text-primary tabular py-2 pl-3 text-right font-mono whitespace-nowrap">
                    {row.total}
                  </td>
                </tr>

                {open.has(row.movieId) ? (
                  <tr
                    id={`breakdown-${row.movieId}`}
                    data-testid={`breakdown-${row.movieId}`}
                    className="lg:hidden"
                  >
                    {/* Film + every show + Total: the show cells are hidden below
                      `lg` but still in the markup, so the count is the full
                      width of the grid. */}
                    <td colSpan={2 + leaderboard.events.length} className="pb-3">
                      <dl className="text-text-secondary flex flex-col gap-1 pl-2 text-xs">
                        {leaderboard.events
                          // 🔴 Only the shows this film actually scored at. The
                          // columns print zeroes because a grid has to be
                          // rectangular; a list does not, and a list of zeroes is
                          // noise the reader has to read past.
                          .filter((event) => (row.events[event.abbreviation] ?? 0) !== 0)
                          .map((event) => (
                            <div
                              key={event.abbreviation}
                              className="flex justify-between gap-4"
                            >
                              {/* The full name, not the code: the reader who
                                opened this is the one who cannot see the
                                legend either. */}
                              <dt>{event.name}</dt>
                              <dd className="tabular font-mono">
                                {row.events[event.abbreviation]}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔴 The columns' names, on the page rather than in a `title`.
          `title` never fires on a touch screen and is unreliable from a
          keyboard, so on every device but a mouse these were unlabelled
          three-letter codes — and the twelve award bodies are the app's
          primary vocabulary, not something a reader arrives knowing.

          Twelve full names will not fit twelve columns at any width, so the
          mapping goes underneath. `hidden lg:flex` matches the columns it
          explains: a legend for columns nobody can see is noise, and below
          `lg` the expandable row does this job instead. */}
      <ul className="text-text-dim hidden flex-wrap gap-x-4 gap-y-1 text-xs lg:flex">
        {leaderboard.events.map((event) => (
          <li key={event.abbreviation}>
            <span className="tabular font-mono">{event.abbreviation.toUpperCase()}</span>{' '}
            {event.name}
          </li>
        ))}
      </ul>

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setShown((current) => current + PAGE)}
          className="bg-bg-raised text-text-primary hover:text-accent-text focus-visible:outline-accent-fill flex min-h-11 items-center justify-center gap-2 self-center rounded-sm px-6 text-sm transition-colors focus-visible:outline-2"
        >
          Show {Math.min(PAGE, remaining)} more
          <span className="text-text-dim tabular font-mono text-xs">
            {remaining} left
          </span>
        </button>
      ) : null}
    </div>
  );
}
