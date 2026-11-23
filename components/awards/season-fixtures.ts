import type { SeasonMoment, SeasonView } from '@/lib/services/season-view';

/**
 * The 2026 season as the restored copy holds it, for stories and component
 * tests: key, show, name, phase, date, nominations, winners, categories and
 * the headline film. Not a component module, so Biome lets it export data.
 */
type Row = [
  string,
  string,
  string,
  'nominations' | 'ceremony',
  number,
  number,
  number,
  number,
  string | null,
  number,
];

const ROWS: Row[] = [
  [
    '12-nominations',
    'afi',
    'American Film Institute',
    'nominations',
    1764806400000,
    10,
    0,
    1,
    'Avatar: Fire and Ash',
    1,
  ],
  [
    '2-nominations',
    'gg',
    'Golden Globes',
    'nominations',
    1765152000000,
    92,
    15,
    15,
    'One Battle After Another',
    9,
  ],
  [
    '4-nominations',
    'adg',
    'Art Directors Guild',
    'nominations',
    1767744000000,
    20,
    4,
    4,
    'Avatar: Fire and Ash',
    1,
  ],
  [
    '1-nominations',
    'sag',
    "Screen Actors' Guild",
    'nominations',
    1767744000000,
    30,
    6,
    6,
    'One Battle After Another',
    7,
  ],
  [
    '9-nominations',
    'asc',
    'American Society of Cinematographers',
    'nominations',
    1767830400000,
    8,
    2,
    2,
    '2000 Meters to Andriivka',
    1,
  ],
  [
    '7-nominations',
    'dga',
    'Directors Guild of America',
    'nominations',
    1767830400000,
    15,
    3,
    3,
    '2000 Meters to Andriivka',
    1,
  ],
  [
    '3-nominations',
    'pga',
    'Producers Guild of America',
    'nominations',
    1767916800000,
    21,
    3,
    3,
    'Bugonia',
    1,
  ],
  [
    '2-ceremony',
    'gg',
    'Golden Globes',
    'ceremony',
    1768089600000,
    92,
    15,
    15,
    'One Battle After Another',
    4,
  ],
  [
    '10-nominations',
    'raz',
    'RAZZIE',
    'nominations',
    1768953600000,
    45,
    9,
    9,
    'Snow White',
    6,
  ],
  [
    '8-nominations',
    'oscars',
    'Academy of Motion Picture Arts and Sciences',
    'nominations',
    1769040000000,
    125,
    24,
    24,
    'Sinners',
    16,
  ],
  [
    '11-nominations',
    'ace',
    'American Cinema Editors',
    'nominations',
    1769472000000,
    18,
    4,
    4,
    'Becoming Led Zeppelin',
    1,
  ],
  [
    '6-nominations',
    'bafta',
    'British Academy of Film and Television Arts',
    'nominations',
    1769472000000,
    129,
    25,
    25,
    'One Battle After Another',
    14,
  ],
  [
    '5-nominations',
    'wga',
    'Writers Guild of America',
    'nominations',
    1769472000000,
    13,
    3,
    3,
    '2000 Meters to Andriivka',
    1,
  ],
  [
    '7-ceremony',
    'dga',
    'Directors Guild of America',
    'ceremony',
    1770422400000,
    15,
    3,
    3,
    '2000 Meters to Andriivka',
    1,
  ],
  [
    '6-ceremony',
    'bafta',
    'British Academy of Film and Television Arts',
    'ceremony',
    1771718400000,
    129,
    25,
    25,
    'One Battle After Another',
    6,
  ],
  [
    '11-ceremony',
    'ace',
    'American Cinema Editors',
    'ceremony',
    1772150400000,
    18,
    4,
    4,
    'KPop Demon Hunters',
    1,
  ],
  [
    '4-ceremony',
    'adg',
    'Art Directors Guild',
    'ceremony',
    1772236800000,
    20,
    4,
    4,
    'Frankenstein',
    1,
  ],
  [
    '3-ceremony',
    'pga',
    'Producers Guild of America',
    'ceremony',
    1772236800000,
    21,
    3,
    3,
    'KPop Demon Hunters',
    1,
  ],
  [
    '1-ceremony',
    'sag',
    "Screen Actors' Guild",
    'ceremony',
    1772323200000,
    30,
    6,
    6,
    'Sinners',
    2,
  ],
  [
    '9-ceremony',
    'asc',
    'American Society of Cinematographers',
    'ceremony',
    1772928000000,
    8,
    2,
    2,
    '2000 Meters to Andriivka',
    1,
  ],
  [
    '5-ceremony',
    'wga',
    'Writers Guild of America',
    'ceremony',
    1772928000000,
    13,
    3,
    3,
    '2000 Meters to Andriivka',
    1,
  ],
  [
    '10-ceremony',
    'raz',
    'RAZZIE',
    'ceremony',
    1773446400000,
    45,
    9,
    9,
    'War of the Worlds',
    5,
  ],
  [
    '8-ceremony',
    'oscars',
    'Academy of Motion Picture Arts and Sciences',
    'ceremony',
    1773532800000,
    125,
    24,
    24,
    'One Battle After Another',
    6,
  ],
];

const MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** The day before the Oscars: every moment dated before this has happened. */
export const DAY_BEFORE_OSCARS = Date.UTC(2026, 2, 14, 12);

const OSCAR_FILMS: [string, string, number][] = [
  ['Sinners', '1233413', 16],
  ['One Battle After Another', '1054867', 13],
  ['Frankenstein', '1062722', 9],
  ['Marty Supreme', '1317288', 9],
  ['Sentimental Value', '1124566', 9],
  ['Hamnet', '858024', 8],
  ['Bugonia', '701387', 4],
  ['F1', '911430', 4],
  ['The Secret Agent', '1220564', 4],
  ['Train Dreams', '1241983', 4],
];

/**
 * 2026 as it stood at `asOf`: a moment dated before it is finished, with its
 * counts; one after it is upcoming, with none. The stories' "now".
 */
export function season2026(asOf: number = Number.POSITIVE_INFINITY): SeasonView {
  const moments: SeasonMoment[] = ROWS.map(
    (
      [
        key,
        abbreviation,
        name,
        phase,
        date,
        nominations,
        winners,
        categories,
        title,
        count,
      ],
      index,
    ) => {
      const done = date < asOf;
      const nominationsOut = done || (phase === 'ceremony' && nominations > 0);
      return {
        key,
        eventId: Number(key.split('-')[0]),
        abbreviation,
        name,
        phase,
        date,
        order: index,
        state: done ? 'finished' : 'upcoming',
        nominations: nominationsOut ? nominations : 0,
        winners: done ? winners : 0,
        categories,
        highlight: done && title ? { title, count } : null,
      };
    },
  );
  const months: SeasonView['months'] = [];
  for (const moment of moments) {
    const label = MONTH.format(moment.date as number);
    const last = months.at(-1);
    if (last?.label === label) last.moments.push(moment);
    else months.push({ label, moments: [moment] });
  }
  const upcoming = moments.find((m) => m.state !== 'finished');
  const films =
    upcoming?.abbreviation === 'oscars' && upcoming.phase === 'ceremony'
      ? OSCAR_FILMS
      : [];
  return {
    year: 2026,
    offSeason: false,
    activeYear: 2026,
    past: false,
    months,
    next: upcoming
      ? {
          ...upcoming,
          imageUrl:
            upcoming.abbreviation === 'oscars'
              ? 'https://5d9wubvvsbkemktm.public.blob.vercel-storage.com/award-shows/oscars.jpg'
              : null,
          films: films
            .slice(0, 8)
            .map(([title, tmdbId, count]) => ({ title, tmdbId, count })),
          more: Math.max(0, films.length - 8),
        }
      : null,
  };
}
