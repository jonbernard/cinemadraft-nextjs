import { describe, expect, it } from 'vitest';

import { toMoments } from './moments';

/**
 * The season's scoring moments (P16.T13), on synthetic events. Pure: no
 * database, so it runs on CI.
 */
type Input = Parameters<typeof toMoments>[0];
type Ev = Input['events'][number];

const show = (id: number, over: Partial<Ev> = {}): Ev => ({
  id,
  abbreviation: `s${id}`,
  name: `Show ${id}`,
  hasCeremony: true,
  nomDate: Date.UTC(2026, 0, 8 + id),
  awardsDate: Date.UTC(2026, 2, 1 + id),
  awardsActive: false,
  ...over,
});

const counts = (entries: [number, number][] = []) => new Map(entries);

function moments(over: Partial<Input> & Pick<Input, 'events'>) {
  return toMoments({
    year: 2026,
    activeYear: 2026,
    nominations: counts(),
    winners: counts(),
    ...over,
  });
}

describe('toMoments', () => {
  it('gives a show with no ceremony one moment', () => {
    const list = moments({ events: [show(1), show(2, { hasCeremony: false })] });
    expect(list.map((m) => m.key)).toEqual([
      '1-nominations',
      '2-nominations',
      '1-ceremony',
    ]);
  });

  it('dates a moment only from its own season', () => {
    const list = moments({
      events: [show(1, { nomDate: Date.UTC(2024, 0, 9) })],
    });
    expect(list.find((m) => m.phase === 'nominations')?.date).toBeNull();
    expect(list.find((m) => m.phase === 'ceremony')?.date).toBe(Date.UTC(2026, 2, 2));
  });

  it('takes a stored date for the year over the events columns', () => {
    const stored = Date.UTC(2025, 0, 20);
    const list = moments({
      year: 2025,
      events: [show(1)],
      datesForYear: new Map([[1, { nomDate: stored, awardsDate: null }]]),
    });
    expect(list.find((m) => m.phase === 'nominations')?.date).toBe(stored);
  });

  it('puts a 2019 season with no dates in this year’s order, and finishes it by data', () => {
    const events = [
      show(1, { nomDate: Date.UTC(2026, 0, 22), awardsDate: Date.UTC(2026, 2, 15) }),
      show(2, { nomDate: Date.UTC(2025, 11, 8), awardsDate: Date.UTC(2026, 0, 11) }),
    ];
    const current = moments({ events });
    const past = moments({
      events,
      year: 2019,
      nominations: counts([
        [1, 120],
        [2, 90],
      ]),
      winners: counts([
        [1, 24],
        [2, 25],
      ]),
    });
    expect(past.every((m) => m.date === null)).toBe(true);
    expect(past.map((m) => m.key)).toEqual(current.map((m) => m.key));
    expect(past.map((m) => m.order)).toEqual(current.map((m) => m.order));
    expect(past.every((m) => m.state === 'finished')).toBe(true);
  });

  it('calls an entered ceremony finished though its date is in the future', () => {
    const list = moments({
      events: [show(1, { awardsDate: Date.UTC(2026, 6, 1) })],
      nominations: counts([[1, 10]]),
      winners: counts([[1, 3]]),
    });
    expect(list.map((m) => m.state)).toEqual(['finished', 'finished']);
  });

  it('calls a dated moment with no rows upcoming, whatever the clock says', () => {
    const list = moments({ events: [show(1, { nomDate: Date.UTC(2025, 11, 1) })] });
    expect(list.map((m) => m.state)).toEqual(['upcoming', 'upcoming']);
  });

  it('is live while on air in the active year, and finished on air in a past one', () => {
    const on = [show(1, { awardsActive: true })];
    const current = moments({
      events: on,
      nominations: counts([[1, 10]]),
      winners: counts([[1, 3]]),
    });
    expect(current.find((m) => m.phase === 'ceremony')?.state).toBe('live');
    const past = moments({
      events: on,
      year: 2025,
      nominations: counts([[1, 10]]),
      winners: counts([[1, 3]]),
    });
    expect(past.find((m) => m.phase === 'ceremony')?.state).toBe('finished');
  });

  it('carries the counts, and never calls nominations live', () => {
    const list = moments({
      events: [show(1, { awardsActive: true })],
      nominations: counts([[1, 12]]),
    });
    expect(list[0]).toMatchObject({ nominations: 12, winners: 0, state: 'finished' });
    expect(list[1]?.state).toBe('live');
  });

  it('sorts by order, then nominations first, then name; undated last', () => {
    const day = Date.UTC(2026, 0, 7);
    const list = moments({
      events: [
        show(3, { name: 'Zed', nomDate: day }),
        show(4, { name: 'Alpha', nomDate: day, awardsDate: day }),
        show(5, { nomDate: null, awardsDate: null }),
      ],
    });
    expect(list.map((m) => m.key)).toEqual([
      '4-nominations',
      '3-nominations',
      '4-ceremony',
      '3-ceremony',
      '5-nominations',
      '5-ceremony',
    ]);
  });
});
