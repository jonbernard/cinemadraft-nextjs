'use client';

import { useCallback, useState } from 'react';

import { Panel } from '@/components/Panel';
import { SectionHead } from '@/components/SectionHead';

export type Trailer = { key: string; name: string };

/**
 * How many titles show before the rest go behind a disclosure.
 *
 * 🔴 Thirty-two videos came back for La La Land, and listing all of them made
 * the trailer panel taller than everything else on the page put together —
 * seen in a browser, not predicted. Six covers the trailers and teasers anybody
 * came for; the remaining twenty-six are festival Q&As and awards clips, which
 * are worth having and not worth scrolling past.
 */
const VISIBLE = 6;

/**
 * A film's trailers, loaded only when somebody asks for one.
 *
 * 🔴 **The source mounted every trailer at once.** `movie.videos.results.map`
 * rendered an `<iframe>` per video into a slider
 * (`src/pages/movie/index.jsx:340`) — thirty-two YouTube players for La La Land,
 * each pulling its own script, cookies and thumbnails on a page nobody had asked
 * to watch anything on. That is the single most expensive thing on the old film
 * page and it is entirely avoidable: **one facade**, and the frame appears when
 * clicked.
 *
 * The facade is a button rather than a div with a click handler, so it is
 * reachable by keyboard and announces what it will do. Once a trailer is
 * playing, the other titles remain as a list of buttons — switching is one
 * press, and only ever one iframe exists.
 *
 * `youtube-nocookie.com` rather than `youtube.com`: this page is public and a
 * logged-out reader should not pick up advertising cookies from looking at a
 * film. It is the same embed with the tracking removed.
 */
export function TrailerReel({ trailers }: { trailers: readonly Trailer[] }) {
  const [playing, setPlaying] = useState<Trailer | null>(null);

  const play = useCallback((trailer: Trailer) => setPlaying(trailer), []);

  if (trailers.length === 0) return null;

  const visible = trailers.slice(0, VISIBLE);
  const hidden = trailers.slice(VISIBLE);

  return (
    <section className="flex flex-col gap-3">
      <SectionHead as="h2">Trailers</SectionHead>

      {playing ? (
        <Panel tone="raised" className="aspect-video w-full overflow-hidden">
          <iframe
            // `key` so switching trailers replaces the frame rather than
            // mutating its src, which leaves the old player running in some
            // browsers.
            key={playing.key}
            title={playing.name}
            src={`https://www.youtube-nocookie.com/embed/${playing.key}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </Panel>
      ) : null}

      <ul className="flex flex-col gap-1">
        {visible.map((trailer) => (
          <li key={trailer.key}>
            <TrailerButton
              trailer={trailer}
              isPlaying={playing?.key === trailer.key}
              onPlay={play}
            />
          </li>
        ))}
      </ul>

      {hidden.length > 0 ? (
        // The same native `<details>` the credits panel uses, for the same
        // reasons: the hidden titles stay in the DOM for find-in-page, and the
        // control announces its own expanded state.
        <details className="group">
          <summary className="text-accent-text focus-visible:outline-accent-fill flex min-h-11 cursor-pointer list-none items-center text-sm focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {hidden.length} more clips</span>
            <span className="hidden group-open:inline">Show fewer clips</span>
          </summary>

          <ul className="flex flex-col gap-1">
            {hidden.map((trailer) => (
              <li key={trailer.key}>
                <TrailerButton
                  trailer={trailer}
                  isPlaying={playing?.key === trailer.key}
                  onPlay={play}
                />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function TrailerButton({
  trailer,
  isPlaying,
  onPlay,
}: {
  trailer: Trailer;
  isPlaying: boolean;
  onPlay: (trailer: Trailer) => void;
}) {
  // Bound here rather than in the parent's JSX: `noJsxPropsBind` objects to an
  // arrow in a prop, and passing the trailer down keeps the handler stable.
  const play = useCallback(() => onPlay(trailer), [onPlay, trailer]);

  return (
    <button
      type="button"
      onClick={play}
      aria-current={isPlaying ? 'true' : undefined}
      className="focus-visible:outline-accent-fill hover:bg-bg-raised flex min-h-11 w-full items-center gap-3 px-2 text-left text-sm focus-visible:outline-2"
    >
      {/* 🔴 The triangle needs the circle around it. On its own, at 16px and in
          a vertical list, a filled triangle reads as a disclosure caret rather
          than a play control — the reader expects the row to expand, not to
          start a video. The ring is what makes it the universally understood
          play button. */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className={
          isPlaying
            ? 'text-accent-text h-5 w-5 shrink-0'
            : 'text-text-secondary h-5 w-5 shrink-0'
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
      </svg>
      <span className={isPlaying ? 'text-text-primary' : 'text-text-secondary'}>
        {trailer.name}
      </span>
      {isPlaying ? <span className="sr-only">(playing)</span> : null}
    </button>
  );
}
