// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftedFilmRow, NomineeProgressRow } from '@/lib/repositories/watchlists';

/**
 * The shaping the page depends on, with the database mocked out.
 *
 * The repository's own reads are covered against the captured fixtures in
 * `lib/repositories/watchlists.test.ts`, which needs the restored data and so
 * cannot run on CI. What is tested here is everything above that line —
 * grouping, the two totals, the locale-aware ordering and the dangling row —
 * and it runs on every push.
 */

const findNomineeProgressByUser = vi.fn();
const findNominatedFilmProgressByUser = vi.fn();
const findDraftedFilmProgressByUser = vi.fn();
const findPageByUser = vi.fn();
const findManyByIds = vi.fn();

vi.mock('@/lib/repositories/watchlists', () => ({
  watchlistRepository: {
    findNomineeProgressByUser: (...args: unknown[]) => findNomineeProgressByUser(...args),
    findNominatedFilmProgressByUser: (...args: unknown[]) =>
      findNominatedFilmProgressByUser(...args),
    findDraftedFilmProgressByUser: (...args: unknown[]) =>
      findDraftedFilmProgressByUser(...args),
    findPageByUser: (...args: unknown[]) => findPageByUser(...args),
  },
}));

vi.mock('@/lib/repositories/movies', () => ({
  movieRepository: { findManyByIds: (...args: unknown[]) => findManyByIds(...args) },
}));

const { loadDraftedProgress, loadNominatedProgress, loadShowProgress, loadWatchedFilms } =
  await import('./watchlist');

const USER = 3;

function nominee(over: Partial<NomineeProgressRow> = {}): NomineeProgressRow {
  return {
    nominationId: 1,
    showName: 'Academy of Motion Picture Arts and Sciences',
    awardName: 'Best Picture',
    movieId: 10,
    tmdbId: '10',
    title: 'Anora',
    sortTitle: 'Anora',
    releaseDate: null,
    poster: '/anora.jpg',
    watched: false,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadShowProgress', () => {
  it('groups nominations into shows and awards, both ordered by name', async () => {
    findNomineeProgressByUser.mockResolvedValue([
      nominee({ nominationId: 1, showName: 'RAZZIE', awardName: 'Worst Actor' }),
      nominee({ nominationId: 2, showName: 'Golden Globes', awardName: 'Best Score' }),
      nominee({ nominationId: 3, showName: 'Golden Globes', awardName: 'Best Actor' }),
    ]);

    const shows = await loadShowProgress(USER, 2026);

    expect(shows.map((show) => show.show)).toEqual(['Golden Globes', 'RAZZIE']);
    expect(shows[0].awards.map((award) => award.award)).toEqual([
      'Best Actor',
      'Best Score',
    ]);
  });

  it('counts films and nominations separately — they answer different questions', async () => {
    // One film nominated three times, seen; one nominated once, not seen.
    findNomineeProgressByUser.mockResolvedValue([
      nominee({ nominationId: 1, movieId: 10, awardName: 'Best Picture', watched: true }),
      nominee({
        nominationId: 2,
        movieId: 10,
        awardName: 'Best Director',
        watched: true,
      }),
      nominee({ nominationId: 3, movieId: 10, awardName: 'Best Actor', watched: true }),
      nominee({ nominationId: 4, movieId: 20, title: 'Wicked', awardName: 'Best Actor' }),
    ]);

    const [show] = await loadShowProgress(USER, 2026);

    expect(show.seenNominations).toBe(3);
    expect(show.nominations).toBe(4);
    expect(show.seenFilms).toBe(1);
    expect(show.films).toBe(2);
  });

  it('orders nominees by their sort title, accents included', async () => {
    // 🔴 A code-point sort puts "Émilia" after "Zootopia"; a collator does not.
    findNomineeProgressByUser.mockResolvedValue([
      nominee({ nominationId: 1, movieId: 1, title: 'Zootopia', sortTitle: 'Zootopia' }),
      nominee({
        nominationId: 2,
        movieId: 2,
        title: 'Émilia Pérez',
        sortTitle: 'Émilia Pérez',
      }),
      nominee({ nominationId: 3, movieId: 3, title: 'Anora', sortTitle: 'Anora' }),
    ]);

    const [show] = await loadShowProgress(USER, 2026);

    expect(show.awards[0].nominees.map((n) => n.title)).toEqual([
      'Anora',
      'Émilia Pérez',
      'Zootopia',
    ]);
  });

  it('sorts by the sort title but renders the real one', async () => {
    findNomineeProgressByUser.mockResolvedValue([
      nominee({ nominationId: 1, movieId: 1, title: 'Anora', sortTitle: 'Anora' }),
      nominee({
        nominationId: 2,
        movieId: 2,
        title: 'The Brutalist',
        sortTitle: 'Brutalist',
      }),
    ]);

    const [show] = await loadShowProgress(USER, 2026);
    expect(show.awards[0].nominees.map((n) => n.title)).toEqual([
      'Anora',
      'The Brutalist',
    ]);
  });

  it('returns nothing for a season with no nominations', async () => {
    findNomineeProgressByUser.mockResolvedValue([]);
    expect(await loadShowProgress(USER, 1900)).toEqual([]);
  });
});

describe('loadNominatedProgress', () => {
  it('orders by nomination count, breaking ties on the title', async () => {
    findNominatedFilmProgressByUser.mockResolvedValue([
      {
        ...nominee({ movieId: 1, title: 'Wicked', sortTitle: 'Wicked' }),
        nominations: 5,
      },
      { ...nominee({ movieId: 2, title: 'Anora', sortTitle: 'Anora' }), nominations: 5 },
      { ...nominee({ movieId: 3, title: 'Flow', sortTitle: 'Flow' }), nominations: 9 },
    ]);

    const progress = await loadNominatedProgress(USER, 2026);

    expect(progress.films.map((film) => film.title)).toEqual(['Flow', 'Anora', 'Wicked']);
    expect(progress.total).toBe(3);
  });

  it('counts how many of the year’s nominated films the reader has seen', async () => {
    findNominatedFilmProgressByUser.mockResolvedValue([
      { ...nominee({ movieId: 1, watched: true }), nominations: 2 },
      { ...nominee({ movieId: 2, watched: false }), nominations: 1 },
    ]);

    const progress = await loadNominatedProgress(USER, 2026);
    expect(progress.seen).toBe(1);
    expect(progress.total).toBe(2);
  });
});

describe('loadDraftedProgress', () => {
  it('groups by league and counts each league separately', async () => {
    const rows = [
      {
        ...nominee({ movieId: 1, title: 'Wicked', sortTitle: 'Wicked', watched: true }),
        leagueId: 1,
        leagueName: 'Racso award',
      },
      {
        ...nominee({ movieId: 2, title: 'Anora', sortTitle: 'Anora' }),
        leagueId: 1,
        leagueName: 'Racso award',
      },
      {
        ...nominee({ movieId: 3, title: 'Flow', sortTitle: 'Flow' }),
        leagueId: 70,
        leagueName: 'JB Draft Test',
      },
    ] as unknown as DraftedFilmRow[];
    findDraftedFilmProgressByUser.mockResolvedValue(rows);

    const leagues = await loadDraftedProgress(USER, 2026);

    expect(leagues.map((league) => league.league)).toEqual([
      'JB Draft Test',
      'Racso award',
    ]);
    const racso = leagues[1];
    expect(racso.films.map((film) => film.title)).toEqual(['Anora', 'Wicked']);
    expect(racso.seen).toBe(1);
    expect(racso.total).toBe(2);
  });

  it('returns nothing for a member with no drafted league', async () => {
    findDraftedFilmProgressByUser.mockResolvedValue([]);
    expect(await loadDraftedProgress(USER, 2026)).toEqual([]);
  });
});

describe('loadWatchedFilms', () => {
  const entry = (id: number, movieId: number | null) => ({
    id,
    movieId,
    userId: USER,
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: null,
  });

  const movie = (id: number, title: string) => ({
    id,
    title,
    sortTitle: title,
    fbId: null,
    imdbId: null,
    tmdbId: String(id * 100),
    poster: `/${id}.jpg`,
    backdrop: null,
    releaseDate: new Date('2025-11-01T00:00:00Z'),
    createdAt: null,
    updatedAt: null,
    accentHex: null,
  });

  it('keeps the order the repository sorted, which findManyByIds does not promise', async () => {
    findPageByUser.mockResolvedValue({
      entries: [entry(1, 30), entry(2, 10), entry(3, 20)],
      pagination: { count: 3, page: 1, pageCount: 1 },
    });
    findManyByIds.mockResolvedValue([
      movie(10, 'Anora'),
      movie(20, 'Flow'),
      movie(30, 'Wicked'),
    ]);

    const page = await loadWatchedFilms({
      userId: USER,
      page: 1,
      sortBy: 'createdAt',
      direction: 'desc',
    });

    expect(page.films.map((film) => film.title)).toEqual(['Wicked', 'Anora', 'Flow']);
    expect(findManyByIds).toHaveBeenCalledTimes(1);
  });

  it('drops an entry whose movie is gone rather than rendering a blank row', async () => {
    findPageByUser.mockResolvedValue({
      entries: [entry(1, 10), entry(2, 999), entry(3, null)],
      pagination: { count: 3, page: 1, pageCount: 1 },
    });
    findManyByIds.mockResolvedValue([movie(10, 'Anora')]);

    const page = await loadWatchedFilms({
      userId: USER,
      page: 1,
      sortBy: 'createdAt',
      direction: 'desc',
    });

    expect(page.films).toHaveLength(1);
    // The count is the table's, not the rendered list's — paging depends on it.
    expect(page.count).toBe(3);
  });

  it('marks every entry watched, because that is what being on the list means', async () => {
    findPageByUser.mockResolvedValue({
      entries: [entry(1, 10)],
      pagination: { count: 1, page: 1, pageCount: 1 },
    });
    findManyByIds.mockResolvedValue([movie(10, 'Anora')]);

    const page = await loadWatchedFilms({
      userId: USER,
      page: 1,
      sortBy: 'releaseDate',
      direction: 'asc',
    });

    expect(page.films[0].watched).toBe(true);
    expect(page.films[0].posterUrl).toContain('/w185/10.jpg');
  });

  it('asks for no movies at all when the page is empty', async () => {
    findPageByUser.mockResolvedValue({
      entries: [],
      pagination: { count: 0, page: 1, pageCount: 0 },
    });
    findManyByIds.mockResolvedValue([]);

    const page = await loadWatchedFilms({
      userId: USER,
      page: 1,
      sortBy: 'createdAt',
      direction: 'desc',
    });

    expect(page.films).toEqual([]);
  });
});
