import type { Moment } from '@/lib/services/moments';
import { type Race, toRace } from '@/lib/services/race';
import type { SeasonLedger } from '@/lib/services/season-ledger';
import { rankSeats } from '@/lib/utils/rank';

/**
 * League-1-shaped races for stories and component tests (P16.T22), through
 * the real `toRace` and `rankSeats`. The ledger is built here rather than by
 * `buildSeasonLedger`, whose module loads the database client, which neither
 * Storybook's browser bundle nor a parallel-project test may import. Not a
 * component module, so Biome lets it export data.
 */
const SHOWS: [abbreviation: string, name: string, nom: number, awards: number | null][] =
  [
    ['afi', 'AFI Awards', Date.UTC(2025, 11, 4), null],
    ['gg', 'Golden Globes', Date.UTC(2025, 11, 8), Date.UTC(2026, 0, 11)],
    ['cc', 'Critics Choice', Date.UTC(2025, 11, 5), Date.UTC(2026, 0, 4)],
    ['sag', 'Actor Awards', Date.UTC(2026, 0, 7), Date.UTC(2026, 2, 1)],
    ['pga', 'Producers Guild', Date.UTC(2026, 0, 9), Date.UTC(2026, 1, 28)],
    ['dga', 'Directors Guild', Date.UTC(2026, 0, 8), Date.UTC(2026, 1, 7)],
    ['wga', 'Writers Guild', Date.UTC(2026, 0, 15), Date.UTC(2026, 2, 8)],
    ['bafta', 'BAFTA', Date.UTC(2026, 0, 27), Date.UTC(2026, 1, 22)],
    ['oscars', 'Academy Awards', Date.UTC(2026, 0, 22), Date.UTC(2026, 2, 15)],
  ];

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

function moments(dated: boolean): Moment[] {
  return SHOWS.flatMap(([abbreviation, name, nom, awards], index) => {
    const base = { eventId: index + 1, abbreviation, name, state: 'finished' as const };
    const list: Moment[] = [
      {
        ...base,
        key: `${index + 1}-nominations`,
        phase: 'nominations',
        date: dated ? nom : null,
        order: nom,
        nominations: 5,
        winners: 0,
      },
    ];
    if (awards != null)
      list.push({
        ...base,
        key: `${index + 1}-ceremony`,
        phase: 'ceremony',
        date: dated ? awards : null,
        order: awards,
        nominations: 5,
        winners: 5,
      });
    return list;
  }).sort((a, b) => a.order - b.order);
}

/** Points per seat per moment; `flat` gives everyone the same. */
function gain(seat: number, step: number, flat: boolean): number {
  return flat ? 20 : ((seat * 7 + step * 13) % 9) * 10 + (step % 4 === seat % 4 ? 60 : 0);
}

/** name → final total, for a test to hold the table's last column against. */
export function raceTotals({
  dated = true,
  flat = false,
  count = 16,
} = {}): Map<string, number> {
  const steps = moments(dated).length;
  return new Map(
    NAMES.slice(0, count).map((name, seat) => {
      let total = 0;
      for (let step = 0; step < steps; step++) total += gain(seat, step, flat);
      return [name, total];
    }),
  );
}

export function raceFixture({
  dated = true,
  flat = false,
  count = 16,
  viewer = 1004 as number | null,
} = {}): Race {
  const seats = NAMES.slice(0, count).map((name, index) => ({
    draftId: 100 + index,
    userId: 1000 + index,
    name,
  }));
  const running = seats.map(() => 0);
  const steps = moments(dated).map((moment, step) => {
    const delta = new Map(
      seats.map((seat, index) => {
        const points = gain(index, step, flat);
        running[index] = (running[index] ?? 0) + points;
        return [seat.draftId, points];
      }),
    );
    const standings = rankSeats(
      seats.map((seat, index) => ({ ...seat, total: running[index] ?? 0 })),
      viewer,
    );
    return { moment, delta, standings, moves: new Map(), films: [] };
  });
  return toRace({
    seats: seats as unknown as SeasonLedger['seats'],
    steps,
    latest: steps.at(-1) ?? null,
  });
}
