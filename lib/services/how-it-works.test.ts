// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLeaderboard = vi.fn();
const ledgerForMovies = vi.fn();
const getActiveYear = vi.fn();
const availableSeasons = vi.fn();
const findManyByIds = vi.fn();
const pointsFindAll = vi.fn();
const eventsFindAll = vi.fn();
const awardsFindAll = vi.fn();

vi.mock('@/lib/services/leaderboard', () => ({ getLeaderboard, availableSeasons }));
vi.mock('@/lib/services/scoring', () => ({ ledgerForMovies }));
vi.mock('@/lib/services/season', () => ({ getActiveYear }));
vi.mock('@/lib/repositories/movies', () => ({
  movieRepository: { findManyByIds },
}));
vi.mock('@/lib/repositories/points', () => ({
  pointRepository: { findAll: pointsFindAll },
}));
vi.mock('@/lib/repositories/events', () => ({
  eventRepository: { findAll: eventsFindAll },
}));
vi.mock('@/lib/repositories/awards', () => ({
  awardRepository: { findAll: awardsFindAll },
}));

const { getWorkedExample, getShowGroups, getLandingFacts } = await import(
  './how-it-works'
);

/** A board row as `getLeaderboard` shapes one. */
function row(movieId: number, title: string, total: number) {
  return { movieId, title, events: {}, total };
}

/** A ledger as `ledgerForMovies` shapes one: total IS the sum of lines. */
function ledger(movieId: number, lines: { points: number; won: boolean }[]) {
  const full = lines.map((line, index) => ({
    nominationId: movieId * 100 + index,
    awardId: index,
    awardName: `Award ${index}`,
    eventAbbreviation: 'oscars',
    eventName: 'Academy Awards',
    points: line.points,
    won: line.won,
    earned: line.won ? line.points * 2 : line.points,
  }));
  return {
    movieId,
    lines: full,
    total: full.reduce((sum, line) => sum + line.earned, 0),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findManyByIds.mockResolvedValue([]);
});

describe('getWorkedExample', () => {
  it('takes the top-scoring film of the active season', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026, 2025]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 90), row(8, 'Middle', 40)],
    });
    ledgerForMovies.mockResolvedValue(
      new Map([
        [
          7,
          ledger(7, [
            { points: 20, won: true },
            { points: 15, won: true },
            { points: 20, won: false },
          ]),
        ],
        [8, ledger(8, [{ points: 20, won: true }])],
      ]),
    );

    const example = await getWorkedExample();

    expect(example?.year).toBe(2026);
    expect(example?.isActiveSeason).toBe(true);
    expect(example?.best.title).toBe('Top');
    expect(example?.best.movieId).toBe(7);
  });

  // 🔴 The board row says 999 and the ledger says 75. The ledger wins: it is
  // the object whose `total` is by construction the sum of its lines
  // (lib/services/scoring.ts). A service that trusted the row would print a
  // total its own line items do not add up to.
  it('reports the ledger own total, never a re-sum of the board row', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 999)],
    });
    const only = ledger(7, [
      { points: 20, won: true },
      { points: 35, won: false },
    ]);
    ledgerForMovies.mockResolvedValue(new Map([[7, only]]));

    const example = await getWorkedExample();

    expect(example?.best.total).toBe(75);
    expect(example?.best.lines.reduce((sum, line) => sum + line.earned, 0)).toBe(75);
  });

  it('falls back to the newest season that has data, and says so', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2027, 2026, 2025]);
    getLeaderboard.mockImplementation(async (year: number) =>
      year === 2025
        ? { year, events: [], rows: [row(7, 'Old', 30)] }
        : { year, events: [], rows: [] },
    );
    ledgerForMovies.mockResolvedValue(
      new Map([[7, ledger(7, [{ points: 15, won: true }])]]),
    );

    const example = await getWorkedExample();

    expect(example?.year).toBe(2025);
    expect(example?.isActiveSeason).toBe(false);
    // 2027 is newer than the active season and must never be reached for.
    expect(getLeaderboard).not.toHaveBeenCalledWith(2027);
  });

  it('returns null rather than a zero when no season has been scored at all', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026, 2025]);
    getLeaderboard.mockResolvedValue({ year: 2026, events: [], rows: [] });

    expect(await getWorkedExample()).toBeNull();
  });

  it('returns null rather than throwing when no season exists at all', async () => {
    // 🔴 `getActiveYear` really does throw on an empty `available_years` —
    // "no seasons exist", by design, because a guessed year would silently
    // scope every query to a season that is not there. A signed-out reader on
    // a freshly migrated database must get the page's prose, not a 500, so the
    // service asks which season is active only once it knows there is one.
    // Mocked as a rejection here rather than as `[]`, because a bare empty
    // list passes with or without the guard and would be a check that cannot
    // fail.
    getActiveYear.mockRejectedValue(new Error('no seasons exist'));
    availableSeasons.mockResolvedValue([]);

    expect(await getWorkedExample()).toBeNull();
    expect(getActiveYear).not.toHaveBeenCalled();
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it('names the season casualty only when its total is actually negative', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 40), row(9, 'Razzed', -30)],
    });
    ledgerForMovies.mockResolvedValue(
      new Map([
        [7, ledger(7, [{ points: 20, won: true }])],
        [
          9,
          ledger(9, [
            { points: -20, won: true },
            { points: 10, won: false },
          ]),
        ],
      ]),
    );

    const example = await getWorkedExample();
    expect(example?.worst?.title).toBe('Razzed');
    expect(example?.worst?.total).toBeLessThan(0);
  });

  it('names no casualty when the lowest-scoring film still scored something', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 40), row(9, 'Modest', 5)],
    });
    ledgerForMovies.mockResolvedValue(
      new Map([
        [7, ledger(7, [{ points: 20, won: true }])],
        [9, ledger(9, [{ points: 5, won: false }])],
      ]),
    );

    expect((await getWorkedExample())?.worst).toBeNull();
  });

  it('attaches the poster of each chosen film, and null when there is none', async () => {
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026]);
    getLeaderboard.mockResolvedValue({
      year: 2026,
      events: [],
      rows: [row(7, 'Top', 40), row(9, 'Razzed', -30)],
    });
    ledgerForMovies.mockResolvedValue(
      new Map([
        [7, ledger(7, [{ points: 20, won: true }])],
        [9, ledger(9, [{ points: -30, won: false }])],
      ]),
    );
    findManyByIds.mockResolvedValue([
      { id: 7, poster: '/abc.jpg' },
      { id: 9, poster: null },
    ]);

    const example = await getWorkedExample();
    expect(example?.best.posterUrl).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(example?.worst?.posterUrl).toBeNull();
  });
});

describe('the rule the page states in words', () => {
  // The page says "a win earns it a second time — twice a nomination's value".
  // That sentence is the one number on the page that is a word, so it is
  // pinned here against the function rather than against a comment. If the
  // rule ever stops doubling, this fails and the copy must change with it.
  it('makes a win worth exactly twice a nomination, per the scoring rule itself', async () => {
    const { scoreMovies } =
      await vi.importActual<typeof import('./scoring')>('./scoring');

    const nominated = scoreMovies({
      nominations: [{ id: 1, movieId: 1, awardId: 9 }],
      pointsByAward: new Map([[9, 7]]),
      winnersByAward: new Map(),
    });
    const won = scoreMovies({
      nominations: [{ id: 1, movieId: 1, awardId: 9 }],
      pointsByAward: new Map([[9, 7]]),
      winnersByAward: new Map([[9, new Set([1])]]),
    });

    expect(nominated.get(1)).toBe(7);
    expect(won.get(1)).toBe(14);
  });
});

describe('getShowGroups', () => {
  // The shape the restored data has: a show carries no level of its own, and
  // its group is whatever level its own categories' point rows name.
  const points = [
    { id: 1, level: 'Oscars', tier: 1, points: 20 },
    { id: 2, level: 'Oscars', tier: 2, points: 15 },
    { id: 3, level: 'Alphabet', tier: 1, points: 5 },
    { id: 4, level: 'Razzies', tier: 1, points: -20 },
  ];
  const events = [
    { id: 10, name: 'Academy Awards', abbreviation: 'oscars', image: 'oscars.png' },
    { id: 11, name: 'Directors Guild', abbreviation: 'dga', image: null },
    { id: 12, name: 'Razzies', abbreviation: 'raz', image: null },
    {
      id: 13,
      name: 'A show with no scoring categories',
      abbreviation: 'none',
      image: null,
    },
  ];
  const awards = [
    { id: 100, eventId: 10, pointsId: 1 },
    { id: 101, eventId: 10, pointsId: 2 },
    { id: 102, eventId: 11, pointsId: 3 },
    { id: 103, eventId: 12, pointsId: 4 },
    // 🔴 A category that references no point row at all. The restored data
    // holds these, and reading `award.points` as a value rather than as a
    // foreign key is the trap D41 exists for.
    { id: 104, eventId: 13, pointsId: null },
  ];

  beforeEach(() => {
    pointsFindAll.mockResolvedValue(points);
    eventsFindAll.mockResolvedValue(events);
    awardsFindAll.mockResolvedValue(awards);
  });

  it('groups a show by the level its own categories pay at', async () => {
    const groups = await getShowGroups();

    const oscars = groups.find((group) => group.level === 'Oscars');
    expect(oscars?.shows.map((show) => show.abbreviation)).toEqual(['oscars']);
    expect(groups.find((group) => group.level === 'Alphabet')?.shows).toHaveLength(1);
    // The show whose only category references no point row belongs to no
    // group, rather than defaulting into one.
    expect(
      groups.flatMap((group) => group.shows).map((show) => show.abbreviation),
    ).not.toContain('none');
  });

  it('orders the groups by what they pay, so the negative one lands last', async () => {
    const groups = await getShowGroups();

    expect(groups.map((group) => group.level)).toEqual(['Oscars', 'Alphabet', 'Razzies']);
    expect(groups.at(-1)?.tiers.every((tier) => tier.points < 0)).toBe(true);
  });

  it('carries each show its mark, or null when it has none', async () => {
    const groups = await getShowGroups();

    const oscars = groups.find((group) => group.level === 'Oscars')?.shows[0];
    expect(oscars).toMatchObject({
      eventId: 10,
      name: 'Academy Awards',
      imageUrl: 'oscars.png',
    });
    expect(
      groups.find((group) => group.level === 'Razzies')?.shows[0]?.imageUrl,
    ).toBeNull();
  });
});

describe('getLandingFacts', () => {
  const events = [
    { id: 10, name: 'Academy Awards', abbreviation: 'oscars', image: null },
    { id: 11, name: 'Razzies', abbreviation: 'raz', image: null },
  ];

  beforeEach(() => {
    eventsFindAll.mockResolvedValue(events);
    getActiveYear.mockResolvedValue(2026);
    availableSeasons.mockResolvedValue([2026, 2025]);
    findManyByIds.mockResolvedValue([{ id: 1, title: 'A Film', poster: '/a.jpg' }]);
  });

  it('falls back to the last season with leaders when the new one is empty', async () => {
    // 🔴 The ordinary state for months of every year: the season has opened,
    // nominations have not landed, and the active board is empty. The hero
    // must still have a wall.
    getLeaderboard.mockImplementation(async (year: number) =>
      year === 2026
        ? { year, events: [], rows: [] }
        : { year, events: [], rows: [row(1, 'A Film', 620)] },
    );

    const facts = await getLandingFacts();

    expect(facts?.year).toBe(2025);
    expect(facts?.isActiveSeason).toBe(false);
    expect(facts?.films).toHaveLength(1);
  });

  it('still reports what it can count when no season has a board at all', async () => {
    getLeaderboard.mockResolvedValue({ year: 2026, events: [], rows: [] });

    const facts = await getLandingFacts();

    // The shows and the seasons are countable without a single nomination;
    // the wall is empty rather than invented.
    expect(facts).toMatchObject({ shows: 2, seasons: 2, filmsScored: 0, films: [] });
  });

  it('never shows a season the app has not reached yet', async () => {
    availableSeasons.mockResolvedValue([2027, 2026, 2025]);
    getLeaderboard.mockImplementation(async (year: number) => ({
      year,
      events: [],
      rows: year === 2027 ? [row(9, 'Unreleased', 999)] : [row(1, 'A Film', 620)],
    }));

    const facts = await getLandingFacts();

    expect(facts?.year).toBe(2026);
    expect(facts?.films.map((film) => film.title)).not.toContain('Unreleased');
  });
});
