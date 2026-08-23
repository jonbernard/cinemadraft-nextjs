// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Movie } from '@/lib/repositories/movies';
import type { Nomination } from '@/lib/repositories/nominations';
import type { MovieLedger } from './scoring';

/**
 * The season leaderboard's own shaping, with everything below `ledgerForMovies`
 * mocked out — the rule itself is `scoring.test.ts`'s job (D41), and this file
 * exists to prove the grid built on top of it: the grouping by event, the
 * zero-fill for a show a film earned nothing at, and the sort.
 *
 * 🔴 Deliberately **at least two award shows and at least three films**. A
 * fixture of one show cannot tell "grouped by event" from "just the total
 * column repeated", and a fixture whose films already sort the same by total,
 * title and id cannot tell a real sort from a coincidence.
 */

const findByYear = vi.fn();
const findManyByIds = vi.fn();
const findAllEvents = vi.fn();
const listYears = vi.fn();
const ledgerForMovies = vi.fn();

vi.mock('@/lib/repositories/nominations', () => ({
  nominationRepository: { findByYear: (...args: unknown[]) => findByYear(...args) },
}));

vi.mock('@/lib/repositories/movies', () => ({
  movieRepository: { findManyByIds: (...args: unknown[]) => findManyByIds(...args) },
}));

vi.mock('@/lib/repositories/events', () => ({
  eventRepository: { findAll: (...args: unknown[]) => findAllEvents(...args) },
}));

vi.mock('@/lib/repositories/available-years', () => ({
  availableYearRepository: { listYears: (...args: unknown[]) => listYears(...args) },
}));

vi.mock('./scoring', () => ({
  ledgerForMovies: (...args: unknown[]) => ledgerForMovies(...args),
}));

const { getLeaderboard, availableSeasons } = await import('./leaderboard');

function nomination(over: Partial<Nomination> = {}): Nomination {
  return {
    id: 1,
    fbId: null,
    movieId: 1,
    awardId: 1,
    year: 2025,
    detailName: null,
    detailCharacter: null,
    detailId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function movie(over: Partial<Movie> = {}): Movie {
  return {
    id: 1,
    title: 'A Film',
    sortTitle: 'Film',
    fbId: null,
    imdbId: null,
    tmdbId: null,
    poster: null,
    backdrop: null,
    releaseDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Movie;
}

/** A ledger line, trimmed to what `getLeaderboard` reads. */
function line(over: Partial<MovieLedger['lines'][number]> = {}) {
  return {
    nominationId: 1,
    awardId: 1,
    awardName: 'Best Picture',
    eventAbbreviation: 'oscars',
    eventName: 'Academy Awards',
    points: 10,
    won: false,
    earned: 10,
    ...over,
  };
}

function ledger(total: number, lines: ReturnType<typeof line>[]): MovieLedger {
  return { movieId: 0, total, lines };
}

beforeEach(() => {
  vi.clearAllMocks();
  findAllEvents.mockResolvedValue([
    { id: 1, abbreviation: 'oscars', awardsDate: 2 },
    { id: 2, abbreviation: 'gg', awardsDate: 1 },
  ]);
});

/**
 * Three films, two shows, and totals/titles/ids that all disagree with each
 * other — Brutalist (id 3) scores highest but sorts last alphabetically and
 * has the highest id, so a leftover title or id sort would be caught here.
 */
function threeFilmsTwoShows() {
  findByYear.mockResolvedValue([
    nomination({ id: 1, movieId: 1 }),
    nomination({ id: 2, movieId: 2 }),
    nomination({ id: 3, movieId: 3 }),
  ]);
  findManyByIds.mockResolvedValue([
    movie({ id: 1, title: 'Anora' }),
    movie({ id: 2, title: 'Emilia Pérez' }),
    movie({ id: 3, title: 'The Brutalist' }),
  ]);
  ledgerForMovies.mockResolvedValue(
    new Map([
      [
        1,
        ledger(15, [
          line({ eventAbbreviation: 'oscars', eventName: 'Academy Awards', earned: 15 }),
        ]),
      ],
      [
        2,
        ledger(5, [
          line({ eventAbbreviation: 'gg', eventName: 'Golden Globes', earned: 5 }),
        ]),
      ],
      [
        3,
        ledger(40, [
          line({ eventAbbreviation: 'oscars', eventName: 'Academy Awards', earned: 20 }),
          line({ eventAbbreviation: 'gg', eventName: 'Golden Globes', earned: 20 }),
        ]),
      ],
    ]),
  );
}

describe('getLeaderboard', () => {
  it('returns an empty grid rather than erroring when nothing was nominated', async () => {
    findByYear.mockResolvedValue([]);

    const board = await getLeaderboard(2099);

    expect(board).toEqual({ year: 2099, events: [], rows: [] });
    expect(findManyByIds).not.toHaveBeenCalled();
  });

  it('🔴 zero-fills a show the film earned nothing at, rather than leaving it absent', async () => {
    // Anora earned only at the Oscars; a blank Golden Globes cell would read
    // as "unknown" where 0 means "nominated elsewhere, not here".
    threeFilmsTwoShows();

    const board = await getLeaderboard(2025);
    const anora = board.rows.find((row) => row.movieId === 1);

    expect(anora?.events.gg).toBe(0);
    expect(anora?.events.oscars).toBe(15);
  });

  it('🔴 sorts by total, disagreeing with both title and id order', async () => {
    threeFilmsTwoShows();

    const board = await getLeaderboard(2025);

    expect(board.rows.map((row) => row.title)).toEqual([
      'The Brutalist',
      'Anora',
      'Emilia Pérez',
    ]);
  });

  it('🔴 orders columns by the show’s awards date, not by abbreviation', async () => {
    // "bafta" sorts alphabetically before "sag", but its awards date is
    // later — so a comparator that forgot the date and fell back to
    // `localeCompare` would print this same order and pass unnoticed.
    findAllEvents.mockResolvedValue([
      { id: 1, abbreviation: 'bafta', awardsDate: 100 },
      { id: 2, abbreviation: 'sag', awardsDate: 1 },
    ]);
    findByYear.mockResolvedValue([nomination({ id: 1, movieId: 1 })]);
    findManyByIds.mockResolvedValue([movie({ id: 1, title: 'Anora' })]);
    ledgerForMovies.mockResolvedValue(
      new Map([
        [
          1,
          ledger(30, [
            line({ eventAbbreviation: 'bafta', eventName: 'BAFTA', earned: 15 }),
            line({ eventAbbreviation: 'sag', eventName: 'SAG', earned: 15 }),
          ]),
        ],
      ]),
    );

    const board = await getLeaderboard(2025);

    expect(board.events.map((event) => event.abbreviation)).toEqual(['sag', 'bafta']);
  });

  it('🔴 sorts an undated show last rather than to the epoch', async () => {
    // "bafta" sorts alphabetically before "sag" too, so an undated "bafta"
    // landing anywhere but last would be caught by the same disagreement.
    findAllEvents.mockResolvedValue([
      { id: 1, abbreviation: 'bafta', awardsDate: null },
      { id: 2, abbreviation: 'sag', awardsDate: 1 },
    ]);
    findByYear.mockResolvedValue([nomination({ id: 1, movieId: 1 })]);
    findManyByIds.mockResolvedValue([movie({ id: 1, title: 'Anora' })]);
    ledgerForMovies.mockResolvedValue(
      new Map([
        [
          1,
          ledger(30, [
            line({ eventAbbreviation: 'bafta', eventName: 'BAFTA', earned: 15 }),
            line({ eventAbbreviation: 'sag', eventName: 'SAG', earned: 15 }),
          ]),
        ],
      ]),
    );

    const board = await getLeaderboard(2025);

    expect(board.events.map((event) => event.abbreviation)).toEqual(['sag', 'bafta']);
  });

  it('scores movies once per distinct id, not once per nomination', async () => {
    findByYear.mockResolvedValue([
      nomination({ id: 1, movieId: 1 }),
      nomination({ id: 2, movieId: 1 }),
      nomination({ id: 3, movieId: 2 }),
    ]);
    findManyByIds.mockResolvedValue([movie({ id: 1 }), movie({ id: 2 })]);
    ledgerForMovies.mockResolvedValue(new Map());

    await getLeaderboard(2025);

    expect(ledgerForMovies).toHaveBeenCalledWith([1, 2], 2025);
  });

  it('drops a nominated movie id that does not resolve to a movie row', async () => {
    findByYear.mockResolvedValue([nomination({ id: 1, movieId: 999 })]);
    findManyByIds.mockResolvedValue([]);
    ledgerForMovies.mockResolvedValue(new Map());

    const board = await getLeaderboard(2025);

    expect(board.rows).toEqual([]);
  });

  it('🔴 a film with no ledger at all still gets a row, scored zero', async () => {
    // `loadScoringInputs` returns nothing resolvable for a movie whose every
    // nomination's points are unconfigured — the row must still exist with
    // every column zero, not disappear from the grid.
    findByYear.mockResolvedValue([nomination({ id: 1, movieId: 1 })]);
    findManyByIds.mockResolvedValue([movie({ id: 1, title: 'Unscored' })]);
    ledgerForMovies.mockResolvedValue(new Map());

    const board = await getLeaderboard(2025);

    expect(board.rows).toEqual([{ movieId: 1, title: 'Unscored', events: {}, total: 0 }]);
  });
});

describe('availableSeasons', () => {
  it('passes the repository’s years straight through', async () => {
    listYears.mockResolvedValue([2026, 2025, 2017]);

    expect(await availableSeasons()).toEqual([2026, 2025, 2017]);
  });
});
