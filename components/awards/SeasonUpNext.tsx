import Link from 'next/link';
import type { ReactNode } from 'react';

import { ShowLogo } from '@/components/awards/ShowLogo';
import { Panel } from '@/components/ui/Panel';
import { SectionHead } from '@/components/ui/SectionHead';
import type { SeasonView, SeasonViewer } from '@/lib/services/season-view';
import { filmHref } from '@/lib/utils/film-href';
import { countdown, plural, showDay, showWeekday } from '@/lib/utils/season-words';

/**
 * "Up next" on `/award-shows` (P16.T15): the next moment, how far off it is in
 * words, and the films most nominated at that show, capped with "and N more"
 * (owner, §4). Before a show's nominations are out it names no films and says
 * when they are due. With nothing left, the season is complete, and in the
 * off-season the next one's dates come in the autumn.
 *
 * `children` is the signed-in slot: what the reader has at stake (P16.T16).
 * Film names are plain links, not pills (D73).
 */
export function SeasonUpNext({
  view,
  now,
  children,
}: {
  view: Pick<SeasonView, 'next' | 'year' | 'activeYear' | 'offSeason' | 'months'>;
  now: number;
  children?: ReactNode;
}) {
  const { next, year } = view;

  if (!next) {
    const autumn = view.offSeason
      ? view.activeYear
      : year === view.activeYear
        ? year + 1
        : null;
    // The season's final ceremony, and the film that won the most at it.
    const finale = view.months
      .flatMap((month) => month.moments)
      .findLast((moment) => moment.phase === 'ceremony' && moment.state === 'finished');
    return (
      <Panel tone="surface" as="section" className="flex flex-col gap-2 p-5">
        <SectionHead as="h2" className="pb-0">
          The {year} season is complete
        </SectionHead>
        {finale?.highlight ? (
          <p className="text-text-secondary text-sm">
            The last word:{' '}
            <span className="text-text-primary font-serif text-base">
              {finale.highlight.title}
            </span>
            , {plural(finale.highlight.count, 'win')} at the {finale.name}.
          </p>
        ) : null}
        {autumn != null ? (
          <p className="text-text-secondary text-sm">
            Dates for the {autumn} season come in the autumn.
          </p>
        ) : null}
      </Panel>
    );
  }

  const phase = next.phase === 'nominations' ? 'Nominations' : 'Ceremony';
  const when =
    next.state === 'live'
      ? 'on air now'
      : next.date == null
        ? 'date to be announced'
        : countdown(next.date, now);
  const showHref = `/award-shows/${next.abbreviation}?year=${year}`;

  return (
    <Panel tone="surface" as="section" className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-4">
        <ShowLogo imageUrl={next.imageUrl} className="hidden sm:block" />
        <div className="flex min-w-0 flex-col gap-1">
          <SectionHead as="h2" name eyebrow={`Up next · ${when}`} className="pb-0">
            <Link href={showHref} className="hover:text-accent-text">
              {next.name}
            </Link>
          </SectionHead>
          <p className="text-text-secondary text-sm">
            {phase}
            {next.date != null ? (
              <>
                {' · '}
                <time dateTime={new Date(next.date).toISOString().slice(0, 10)}>
                  {showWeekday(next.date)} {showDay(next.date)}
                </time>
              </>
            ) : null}
            {next.categories > 0
              ? ` · ${plural(next.categories, 'category', 'categories')}`
              : null}
          </p>
          {next.state === 'live' ? (
            <Link
              href={`/live/${next.abbreviation}?year=${year}`}
              className="text-accent-text hover:text-text-primary focus-visible:outline-accent-fill flex min-h-11 w-fit items-center text-sm focus-visible:outline-2"
            >
              Follow live →
            </Link>
          ) : null}
        </div>
      </div>

      {next.films.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-text-secondary text-sm">Most nominated here</h3>
          <ol className="grid gap-x-6 sm:grid-cols-2">
            {next.films.map((film) => (
              <li
                key={`${film.tmdbId ?? film.title}`}
                className="flex min-h-11 items-center justify-between gap-3"
              >
                {film.tmdbId ? (
                  <Link
                    href={filmHref({ tmdbId: film.tmdbId, title: film.title })}
                    className="text-text-primary hover:text-accent-text min-w-0 truncate font-serif text-base"
                  >
                    {film.title}
                  </Link>
                ) : (
                  <span className="text-text-primary min-w-0 truncate font-serif text-base">
                    {film.title}
                  </span>
                )}
                <span className="text-text-secondary tabular shrink-0 font-mono text-xs">
                  {plural(film.count, 'nomination')}
                </span>
              </li>
            ))}
          </ol>
          {next.more > 0 ? (
            <Link
              href={showHref}
              className="text-text-secondary hover:text-text-primary flex min-h-11 w-fit items-center text-sm underline"
            >
              and {next.more} more
            </Link>
          ) : null}
        </div>
      ) : next.phase === 'nominations' ? (
        <p className="text-text-secondary text-sm">
          {next.date == null
            ? 'The nominations have no date yet.'
            : `Nominations are announced ${showWeekday(next.date)} ${showDay(next.date)}.`}
        </p>
      ) : null}

      {children}
    </Panel>
  );
}

/**
 * The reader's nominations at stake at the next ceremony (P16.T16): a win
 * pays a nomination's points a second time, so that is the sum. One row per
 * film with its categories, capped like the films above; plain text (D73).
 */
export function AtStake({
  atStake,
  year,
  abbreviation,
}: {
  atStake: NonNullable<SeasonViewer['atStake']>;
  year: number;
  abbreviation: string;
}) {
  if (atStake.nominations === 0) {
    return (
      <p className="text-text-secondary text-sm">None of your films is nominated here.</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-text-secondary text-sm">
        {atStake.nominations === 1
          ? `1 of your nominations is up for ${atStake.points} more points`
          : `${atStake.nominations} of your nominations are up for ${atStake.points} more points`}
      </h3>
      <ul className="flex flex-col">
        {atStake.films.map((film) => (
          <li
            key={film.tmdbId ?? film.title}
            className="flex min-h-11 flex-col justify-center gap-1 py-1 sm:flex-row sm:items-baseline sm:gap-3"
          >
            <span className="text-text-primary shrink-0 font-serif text-base">
              {film.title}
            </span>
            <span className="text-text-secondary text-xs">
              {film.categories.join(', ')}
            </span>
          </li>
        ))}
      </ul>
      {atStake.more > 0 ? (
        <Link
          href={`/award-shows/${abbreviation}?year=${year}`}
          className="text-text-secondary hover:text-text-primary flex min-h-11 w-fit items-center text-sm underline"
        >
          and {atStake.more} more {atStake.more === 1 ? 'film' : 'films'}
        </Link>
      ) : null}
    </div>
  );
}
