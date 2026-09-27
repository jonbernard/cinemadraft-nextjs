import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 🔴 Every scoring rule, through the real services, on a synthetic world.
 *
 * Every repository is replaced by the in-memory rows below, so nothing here
 * needs a database and all of it runs on CI — the restored-data parity checks
 * (`scoring.differential.test.ts`) cannot. The services are the real ones:
 * `getLeagueBoardView` (the league page), `getDashboard`, `loadFilmPage`,
 * `getLeaderboard` and `ledgerForMovies`, so a rule broken anywhere between a
 * nomination row and a printed number goes red here.
 *
 * Expected values are worked by hand from the rule, not read back from the
 * code: a nomination is worth P, the nomination that won pays P again (D125),
 * and a pick counts only its own season's nominations (D126). The P tiers are
 * 20, 10 and the Razzies' −20.
 */

const NOW = 2099;
const LAST = 2098;

type Row = Record<string, unknown>;
const world = vi.hoisted(() => ({
  events: [] as Row[],
  points: [] as Row[],
  awards: [] as Row[],
  movies: [] as Row[],
  nominations: [] as Row[],
  winners: [] as Row[],
  users: [] as Row[],
  leagues: [] as Row[],
  drafts: [] as Row[],
  picks: [] as Row[],
}));

const ids = (list: readonly (number | bigint)[]) => new Set(list.map(Number));
const where = <T extends Row>(
  rows: T[],
  key: string,
  list: readonly (number | bigint)[],
) => {
  const set = ids(list);
  return rows.filter((row) => set.has(row[key] as number));
};

vi.mock('@/lib/repositories/events', () => ({
  eventRepository: {
    findManyByIds: async (list: number[]) => where(world.events, 'id', list),
    findAll: async () => world.events,
    findActive: async () => [],
  },
}));
vi.mock('@/lib/repositories/points', () => ({
  pointRepository: {
    findManyByIds: async (list: number[]) => where(world.points, 'id', list),
  },
}));
vi.mock('@/lib/repositories/awards', () => ({
  awardRepository: {
    findManyByIds: async (list: number[]) => where(world.awards, 'id', list),
  },
}));
vi.mock('@/lib/repositories/nominations', () => ({
  nominationRepository: {
    findManyByMovieIds: async (list: number[]) =>
      where(world.nominations, 'movieId', list),
    findByYear: async (year: number) => world.nominations.filter((n) => n.year === year),
    findYearsByMovieId: async (movieId: number) =>
      [
        ...new Set(
          world.nominations
            .filter((n) => n.movieId === movieId)
            .map((n) => n.year as number),
        ),
      ].sort((a, b) => b - a),
  },
}));
vi.mock('@/lib/repositories/winners', () => ({
  winnerRepository: {
    findManyByAwardIds: async (list: number[], year?: number) =>
      where(world.winners, 'awardId', list).filter(
        (w) => year === undefined || w.year === year,
      ),
  },
}));
vi.mock('@/lib/repositories/movies', () => ({
  movieRepository: {
    findManyByIds: async (list: number[]) => where(world.movies, 'id', list),
    findByTmdbId: async (tmdbId: string) =>
      world.movies.find((m) => m.tmdbId === tmdbId) ?? null,
  },
}));
vi.mock('@/lib/repositories/users', () => ({
  userRepository: {
    findManyByIds: async (list: number[]) => where(world.users, 'id', list),
  },
}));
vi.mock('@/lib/repositories/leagues', () => ({
  leagueRepository: {
    findById: async (id: number) => world.leagues.find((l) => l.id === id),
  },
}));
vi.mock('@/lib/repositories/drafts', () => ({
  draftRepository: {
    // (group, order, id), as the real repository's BY_SEAT orders them.
    findByLeagueIdAndYear: async (leagueId: number, year: number) =>
      world.drafts
        .filter((d) => d.leagueId === leagueId && d.year === year)
        .sort(
          (a, b) =>
            (a.group as number) - (b.group as number) ||
            (a.order as number) - (b.order as number) ||
            (a.id as number) - (b.id as number),
        ),
    findLeagueIdsByUserId: async (userId: number) => [
      ...new Set(world.drafts.filter((d) => d.userId === userId).map((d) => d.leagueId)),
    ],
  },
}));
vi.mock('@/lib/repositories/draft-picks', () => ({
  draftPickRepository: {
    findManyByDraftIds: async (list: number[]) => where(world.picks, 'draftId', list),
    findByMovieId: async (movieId: number) =>
      world.picks.filter((p) => p.movieId === movieId),
  },
}));
vi.mock('@/lib/repositories/available-years', () => ({
  availableYearRepository: {
    findActive: async () => ({ year: NOW }),
    listYears: async () => [NOW, LAST],
  },
}));
vi.mock('@/lib/external/tmdb-now-playing', () => ({ getNowPlaying: async () => [] }));
vi.mock('@/lib/external/omdb', () => ({ fetchOmdb: async () => null }));
vi.mock('@/lib/external/tmdb-film', () => ({
  fetchTmdbFilmPage: async (tmdbId: string) => ({
    tmdbId,
    imdbId: null,
    title: `Film ${tmdbId}`,
    year: null,
    tagline: null,
    overview: null,
    runtimeMinutes: null,
    language: null,
    genres: [],
    releaseDate: null,
    budget: null,
    revenue: null,
    productionCompanies: [],
    backdropPath: null,
    posterPaths: [],
    trailers: [],
    cast: [],
    crew: [],
    similar: [],
  }),
}));

import { getDashboard } from './dashboard';
import { loadFilmPage } from './film';
import { getLeaderboard } from './leaderboard';
import { getLeagueBoardView } from './league-view';
import { ledgerForMovies, pointsForMovieIds } from './scoring';

// The films, by what each one exercises.
const PAIR = 100; // two Original Song nominations, one wins: 3P
const TWO_SEASONS = 101; // nominated in 2098 (and won) and in 2099
const RAZZIE = 102; // a won Razzie: −2P
const UNTIERED = 103; // only nominations whose award has no resolvable tier
const BOTH_WIN = 104; // a pair where both nominations won, plus a duplicate winner row
const WRONG_YEAR = 105; // its winner row carries another season's year
const NAMED = 106; // a winner row's nomination_id is this film's, its movie_id is not
const MISNAMED = 107; // the film that winner row's movie_id names

let nextNomination = 1;
function nominate(movieId: number, awardId: number, year: number): number {
  const id = nextNomination++;
  world.nominations.push({ id, movieId, awardId, year });
  return id;
}
function win(nominationId: number, awardId: number, year: number, movieId: number) {
  world.winners.push({ nominationId, awardId, year, movieId });
}

beforeEach(() => {
  nextNomination = 1;
  world.events = [
    { id: 1, abbreviation: 'oscars', name: 'Academy Awards', awardsDate: 2, nomDate: 1 },
    { id: 2, abbreviation: 'raz', name: 'Razzies', awardsDate: 1, nomDate: 1 },
  ];
  world.points = [
    { id: 1, points: 20 },
    { id: 2, points: 10 },
    { id: 3, points: -20 },
  ];
  world.awards = [
    { id: 10, name: 'Original Song', eventId: 1, pointsId: 1 },
    { id: 11, name: 'Best Picture', eventId: 1, pointsId: 2 },
    { id: 12, name: 'Worst Actor', eventId: 2, pointsId: 3 },
    { id: 13, name: 'Unconfigured', eventId: 1, pointsId: null },
    { id: 14, name: 'Dangling', eventId: 1, pointsId: 99 },
    { id: 15, name: 'Supporting Actor', eventId: 1, pointsId: 2 },
  ];
  world.movies = [
    PAIR,
    TWO_SEASONS,
    RAZZIE,
    UNTIERED,
    BOTH_WIN,
    WRONG_YEAR,
    NAMED,
    MISNAMED,
  ].map((id) => ({ id, title: `Film ${id}`, tmdbId: `t${id}`, poster: null }));
  world.nominations = [];
  world.winners = [];

  const song = nominate(PAIR, 10, NOW);
  nominate(PAIR, 10, NOW);
  win(song, 10, NOW, PAIR);

  const earlier = nominate(TWO_SEASONS, 11, LAST);
  win(earlier, 11, LAST, TWO_SEASONS);
  nominate(TWO_SEASONS, 11, NOW);

  win(nominate(RAZZIE, 12, NOW), 12, NOW, RAZZIE);

  win(nominate(UNTIERED, 13, NOW), 13, NOW, UNTIERED);
  nominate(UNTIERED, 14, NOW);

  const first = nominate(BOTH_WIN, 15, NOW);
  const second = nominate(BOTH_WIN, 15, NOW);
  win(first, 15, NOW, BOTH_WIN);
  win(second, 15, NOW, BOTH_WIN);
  win(first, 15, NOW, BOTH_WIN); // a duplicate row naming the same nomination

  win(nominate(WRONG_YEAR, 11, NOW), 11, LAST, WRONG_YEAR);

  const named = nominate(NAMED, 11, NOW);
  nominate(MISNAMED, 11, NOW);
  win(named, 11, NOW, MISNAMED);
  // A stray row in a category NAMED was never nominated in, pointing at no
  // nomination at all. It must invent nothing.
  win(99_999, 12, NOW, NAMED);

  world.users = [
    {
      id: 1,
      uuid: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
    },
    {
      id: 2,
      uuid: 'u2',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.test',
    },
    {
      id: 3,
      uuid: 'u3',
      firstName: 'Alan',
      lastName: 'Turing',
      email: 'alan@example.test',
    },
  ];
  world.leagues = [
    { id: 1, name: 'Synthetic', draftingStatus: 'complete', ownerIds: [1], uuid: 'l1' },
  ];
  const seat = (id: number, group: number, order: number, extra: Row) => ({
    id,
    leagueId: 1,
    year: NOW,
    group,
    order,
    userId: null,
    dummy: false,
    dummyName: null,
    ...extra,
  });
  world.drafts = [
    seat(1, 1, 1, { userId: 1 }),
    // D7: a placeholder with no name and no user. The source answered HTTP 400
    // for the whole league table; here it is a seat like any other.
    seat(2, 1, 2, { dummy: true }),
    seat(5, 1, 3, { userId: 3 }),
    // A character seat.
    seat(3, 2, 1, { dummy: true, dummyName: 'Hannibal Lecter' }),
    seat(4, 2, 2, { userId: 2 }),
    { ...seat(6, 1, 1, { userId: 1 }), year: LAST },
  ];
  let pickId = 1;
  const pick = (draftId: number, movieId: number, order: number) => ({
    id: pickId++,
    draftId,
    movieId,
    order,
    createdAt: null,
  });
  world.picks = [
    pick(1, PAIR, 1),
    pick(1, WRONG_YEAR, 2),
    pick(2, TWO_SEASONS, 1),
    pick(3, BOTH_WIN, 1),
    pick(3, NAMED, 2),
    pick(3, MISNAMED, 3),
    pick(4, RAZZIE, 1),
    pick(4, UNTIERED, 2),
    pick(6, TWO_SEASONS, 1),
  ];
});

describe('the rule, film by film', () => {
  it('scores each film for the season as worked by hand', async () => {
    const totals = await pointsForMovieIds(
      world.movies.map((m) => m.id as number),
      NOW,
    );

    expect(Object.fromEntries(totals)).toEqual({
      // D125: P + P for the two nominations, P once for the one that won.
      [PAIR]: 20 + 20 + 20,
      // D126: 2099's nomination only. Its 2098 win belongs to 2098.
      [TWO_SEASONS]: 10,
      // Negative tiers double on a win like any other.
      [RAZZIE]: -20 - 20,
      // D5: both nominations won, each pays 2P. The duplicate row naming the
      // first again changes nothing — a nomination wins once. (The source's
      // join paid a row per winner row: 8P for this pair.)
      [BOTH_WIN]: 20 + 20,
      // D6: a winner row whose year is not its nomination's season is not a
      // win in this season. The award-show page reads winners with the same
      // year filter (award-show.ts), so it does not crown it either.
      [WRONG_YEAR]: 10,
      // The win belongs to the nomination the row names, whatever film its
      // movie_id says; the stray Razzie row with no nomination adds nothing.
      [NAMED]: 20,
      [MISNAMED]: 10,
      // UNTIERED is absent: a null tier and a dangling one both score nothing.
    });
  });

  it('scores the earlier season on its own, win included', async () => {
    expect(Object.fromEntries(await pointsForMovieIds([TWO_SEASONS], LAST))).toEqual({
      [TWO_SEASONS]: 20,
    });
  });

  it('marks Won on the winning line of a pair only, and gives an untiered award no line', async () => {
    const ledgers = await ledgerForMovies([PAIR, UNTIERED], NOW);

    expect(ledgers.get(PAIR)?.lines.map(({ won, earned }) => ({ won, earned }))).toEqual([
      { won: true, earned: 40 },
      { won: false, earned: 20 },
    ]);
    expect(ledgers.has(UNTIERED)).toBe(false);
  });

  it('puts only the season’s own nominations on the leaderboard', async () => {
    const board = await getLeaderboard(NOW);
    const row = board.rows.find((entry) => entry.movieId === TWO_SEASONS);

    expect(row?.total).toBe(10);
    // An untiered film still has a row (it was nominated) and scores zero.
    expect(board.rows.find((entry) => entry.movieId === UNTIERED)?.total).toBe(0);
  });
});

describe('the league table', () => {
  it('scores every seat, placeholders and characters included, and ranks them in draft order on a tie', async () => {
    const view = await getLeagueBoardView(1, NOW, null);

    const seats = Object.fromEntries(
      view.groups.flatMap((group) =>
        group.seats.map((seat) => [seat.draftId, seat.total]),
      ),
    );
    expect(seats).toEqual({
      1: 60 + 10, // PAIR + WRONG_YEAR
      2: 10, // TWO_SEASONS, 2099 only
      3: 40 + 20 + 10, // BOTH_WIN + NAMED + MISNAMED
      4: -40, // RAZZIE + UNTIERED (0)
      5: 0, // no picks
    });

    // Draft 1 (group 1) and draft 3 (group 2) tie at 70: draft order, one number.
    expect(
      view.standings.map(({ userId, name, total, position }) => [
        userId,
        name,
        total,
        position,
      ]),
    ).toEqual([
      [1, 'Ada Lovelace', 70, 1],
      [-3, 'Hannibal Lecter', 70, 1],
      [-2, 'Unclaimed seat', 10, 3],
      [3, 'Alan Turing', 0, 4],
      [2, 'Grace Hopper', -40, 5],
    ]);
  });

  it('scores the same film at its own season’s value in each season', async () => {
    // D126: draft 6 took TWO_SEASONS in 2098 and draft 2 took it in 2099.
    const last = await getLeagueBoardView(1, LAST, null);
    const now = await getLeagueBoardView(1, NOW, null);
    const pickIn = (view: typeof now, draftId: number) =>
      view.groups.flatMap((g) => g.seats).find((s) => s.draftId === draftId)?.picks[0]
        ?.points;

    expect(pickIn(last, 6)).toBe(20);
    expect(pickIn(now, 2)).toBe(10);
  });

  it('puts every member on the dashboard exactly where the league page does', async () => {
    // D4: the dashboard used to skip seats with no user before ranking, which
    // here would move Alan Turing from 4th to 2nd.
    for (const userId of [1, 2, 3]) {
      const dashboard = await getDashboard(userId);
      const page = await getLeagueBoardView(1, NOW, userId);
      expect(dashboard.leagues[0]?.standings).toEqual(page.standings);
    }
    expect((await getDashboard(3)).leagues[0]?.position).toBe(4);
  });
});

describe('the film page', () => {
  it('shows each season on its own, newest first', async () => {
    const page = await loadFilmPage(`t${TWO_SEASONS}`);

    expect(page?.scoring?.seasons.map(({ year, total }) => ({ year, total }))).toEqual([
      { year: NOW, total: 10 },
      { year: LAST, total: 20 },
    ]);
  });

  it('has no points panel for a film whose only nominations carry no tier', async () => {
    // D8: the source printed "Total 0". Null here, like a film never
    // nominated — "0" would call an unconfigured category worthless.
    expect((await loadFilmPage(`t${UNTIERED}`))?.scoring).toBeNull();
  });
});
