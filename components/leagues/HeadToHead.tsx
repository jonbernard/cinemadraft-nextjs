import Link from 'next/link';
import type { ReactNode } from 'react';

import { Panel } from '@/components/ui/Panel';
import { PosterFrame } from '@/components/ui/PosterFrame';
import { SectionHead } from '@/components/ui/SectionHead';
import {
  type H2HFilm,
  type HeadToHead as HeadToHeadView,
  headToHeadHeadline,
  headToHeadSentence,
} from '@/lib/services/head-to-head';
import { filmHref } from '@/lib/utils/film-href';
import { ordinal } from '@/lib/utils/season-words';

/** A poster or a title, linked to its film page when it has one. */
function FilmLink({ film, children }: { film: H2HFilm; children: ReactNode }) {
  if (!film.tmdbId) return <>{children}</>;
  return (
    <Link
      href={filmHref({ tmdbId: film.tmdbId, title: film.title })}
      className="hover:text-accent-text focus-visible:outline-accent-fill block focus-visible:outline-2"
    >
      {children}
    </Link>
  );
}

/** One side's films, as a list: title and points (the 390 layout's rule). */
function FilmList({ label, films }: { label: string; films: readonly H2HFilm[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-text-secondary text-xs font-normal">{label}</h3>
      {films.length === 0 ? (
        <p className="text-text-secondary text-sm">None.</p>
      ) : (
        <ul aria-label={label} className="flex flex-col">
          {films.map((film) => (
            <li
              key={film.movieId}
              className="border-border-rule flex items-baseline justify-between gap-3 border-b py-1 text-sm"
            >
              <span className="min-w-0 break-words">
                <FilmLink film={film}>{film.title}</FilmLink>
              </span>
              <span className="text-text-primary tabular font-mono">{film.points}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Two seats, head to head (P16.T24, D136): B's "Compare" from the standings,
 * with C's visuals — the headline, one split bar, one sentence, and the films
 * that make the gap.
 *
 * 🔴 **The bar's colour is never the only carrier.** Each segment's points are
 * printed beside it in words, and the bar itself is `aria-hidden`.
 *
 * Public, like the board (D136): a follower compares the leader with the row
 * they picked; a seated reader is always `a`.
 */
export function HeadToHead({
  h2h,
  closeHref,
}: {
  h2h: HeadToHeadView;
  /** The page without `?vs=`. */
  closeHref: string;
}) {
  const { a, b } = h2h;
  const aLabel = a.isViewer ? 'You' : a.name;
  const total = h2h.uniqueA + h2h.sharedPoints + h2h.uniqueB || 1;
  const width = (points: number) => `${(points / total) * 100}%`;
  const segments = [
    { key: 'a', label: `${aLabel} only`, points: h2h.uniqueA, swatch: 'bg-accent-fill' },
    { key: 'shared', label: 'Both', points: h2h.sharedPoints, swatch: 'bg-text-dim' },
    { key: 'b', label: `${b.name} only`, points: h2h.uniqueB, swatch: 'bg-beam' },
  ];

  return (
    // biome-ignore lint/correctness/useUniqueElementIds: the Compare links' `#head-to-head` fragment, so a phone lands on the comparison rather than the table it tapped; one per page, like AppShell's skip target.
    <section id="head-to-head" aria-label="Head to head" className="min-w-0">
      <Panel className="flex flex-col gap-5 p-5">
        <SectionHead
          as="h2"
          className="pb-0"
          eyebrow={`Head to head · ${ordinal(a.position)} against ${ordinal(b.position)}`}
          rightStacksOnMobile
          right={
            <Link
              href={closeHref}
              className="text-text-secondary hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 items-center font-sans underline underline-offset-4 focus-visible:outline-2"
            >
              Close
            </Link>
          }
        >
          {headToHeadHeadline(h2h)}
        </SectionHead>

        <div className="flex flex-col gap-2">
          <div
            aria-hidden="true"
            data-split-bar
            className="bg-bg-surface flex h-3 w-full overflow-hidden rounded-sm"
          >
            {segments.map((segment) => (
              <span
                key={segment.key}
                className={`${segment.swatch} h-full`}
                style={{ width: width(segment.points) }}
              />
            ))}
          </div>
          <ul
            aria-label="Where the points come from"
            className="flex flex-wrap gap-x-5 gap-y-1 text-sm"
          >
            {segments.map((segment) => (
              <li
                key={segment.key}
                data-segment={segment.key}
                className="text-text-secondary flex items-center gap-2"
              >
                <span
                  aria-hidden="true"
                  className={`${segment.swatch} size-2 rounded-sm`}
                />
                {segment.label}
                <span className="text-text-primary tabular font-mono" data-points>
                  {segment.points}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-text-secondary text-sm leading-relaxed">
          {headToHeadSentence(h2h)}
        </p>

        {h2h.gap.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-text-secondary text-xs font-normal">
              Films that make the gap
            </h3>
            <ul
              aria-label="Films that make the gap"
              className="grid grid-cols-4 gap-2 sm:gap-3"
            >
              {h2h.gap.map((film) => (
                <li
                  key={`${film.side}-${film.movieId}`}
                  className="flex min-w-0 flex-col gap-1"
                >
                  <FilmLink film={film}>
                    <PosterFrame
                      title={film.title}
                      posterUrl={film.posterUrl}
                      points={film.points}
                      status={film.status}
                    />
                  </FilmLink>
                  <span className="text-text-secondary truncate text-xs">
                    {film.side === 'a' ? aLabel : b.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-3">
          <FilmList label={`${aLabel} only`} films={h2h.onlyA} />
          {h2h.sameGroup ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-text-secondary text-xs font-normal">Both</h3>
              <p className="text-text-secondary text-sm">
                Same group, so no film is on both teams.
              </p>
            </div>
          ) : (
            <FilmList label="Both" films={h2h.shared} />
          )}
          <FilmList label={`${b.name} only`} films={h2h.onlyB} />
        </div>
      </Panel>
    </section>
  );
}
