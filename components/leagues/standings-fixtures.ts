import type { StandingsView, WhatMovedView } from '@/lib/services/season-ledger';

/**
 * League-1-shaped standings for stories and component tests (P16.T19): the
 * morning after the 2026 Oscars. Not a component module, so Biome lets it
 * export data.
 */
const NAMES = [
  'Sasha Downey',
  'Jacob Marlow',
  'Robert Bernard',
  'Micah Baird',
  'Jon Bernard',
  'Priya Shah',
  'Dana Wells',
  'Theo Park',
  'Ines Moreau',
  'Luca Ferri',
  'Maya Chen',
  'Owen Hale',
  'Rosa Diaz',
  'Sam Keller',
  'Tara Quinn',
  'Victor Lang',
];

export const SHOWS: StandingsView['shows'] = [
  { abbreviation: 'gg', name: 'Golden Globes' },
  { abbreviation: 'dga', name: 'Directors Guild' },
  { abbreviation: 'pga', name: 'Producers Guild' },
  { abbreviation: 'sag', name: 'Screen Actors Guild' },
  { abbreviation: 'bafta', name: 'BAFTA' },
  { abbreviation: 'wga', name: 'Writers Guild' },
  { abbreviation: 'oscars', name: 'Academy Awards' },
];

export function sixteenSeats(): StandingsView['rows'] {
  return NAMES.map((name, index) => {
    const byShow = Object.fromEntries(
      SHOWS.map((show, s) => [show.abbreviation, ((index + 3) * (s + 5) * 7) % 120]),
    );
    const total = Object.values(byShow).reduce((sum, points) => sum + points, 0);
    return {
      draftId: 100 + index,
      name,
      uuid: null,
      isViewer: index === 4,
      position: 0,
      byShow,
      last: byShow.oscars ?? 0,
      move: index % 5 === 0 ? 0 : index % 2 === 0 ? 1 : -1,
      total,
    };
  })
    .sort((a, b) => b.total - a.total)
    .map((row, index, all) => ({
      ...row,
      position: all.findIndex((other) => other.total === row.total) + 1,
      move: index === 0 ? 0 : row.move,
    }));
}

const OSCARS_CEREMONY: WhatMovedView['moment'] = {
  key: '9-ceremony',
  abbreviation: 'oscars',
  name: 'Academy Awards',
  phase: 'ceremony',
  date: Date.UTC(2026, 2, 15),
  state: 'finished',
  winners: 24,
  categories: null,
};

export const KEEPS_LEAD: WhatMovedView = {
  moment: OSCARS_CEREMONY,
  leaders: ['Sasha Downey'],
  previousLeader: 'Sasha Downey',
  leadChanged: false,
  gains: [
    { draftId: 100, name: 'Sasha Downey', points: 120 },
    { draftId: 102, name: 'Robert Bernard', points: 95 },
    { draftId: 101, name: 'Jacob Marlow', points: 60 },
  ],
  movers: [
    { draftId: 102, name: 'Robert Bernard', from: 5, to: 3 },
    { draftId: 103, name: 'Micah Baird', from: 3, to: 4 },
    { draftId: 104, name: 'Jon Bernard', from: 4, to: 5 },
  ],
  films: [
    {
      title: 'One Battle After Another',
      posterUrl: null,
      points: 85,
      won: 6,
      holders: 4,
    },
    { title: 'Sinners', posterUrl: null, points: 40, won: 4, holders: 3 },
    { title: 'Hamnet', posterUrl: null, points: 10, won: 1, holders: 1 },
  ],
};

export const TAKES_LEAD: WhatMovedView = {
  ...KEEPS_LEAD,
  leaders: ['Jacob Marlow'],
  previousLeader: 'Sasha Downey',
  leadChanged: true,
};

export const LIVE: WhatMovedView = {
  ...KEEPS_LEAD,
  moment: { ...OSCARS_CEREMONY, state: 'live', winners: 14, categories: 24 },
};

export const UNDATED_PAST: WhatMovedView = {
  ...KEEPS_LEAD,
  moment: { ...OSCARS_CEREMONY, date: null },
};
