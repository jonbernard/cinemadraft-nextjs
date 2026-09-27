// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { countQueries } from '@/test/query-count';

import { getDraftList } from './draft-list';

/**
 * The page's whole read path: the manual join to `movies`, the poster URL, the
 * release year, and the row whose film has left the catalogue.
 *
 * Seeded, so this runs on CI. `lists` declares no foreign keys, so `USER` needs
 * no user row — and that is also what makes the missing-film case reachable.
 */
const TAG = 'draft-list-service';
const USER = 900_101;
const YEAR = 2095;

async function seedFilm(title: string, poster: string | null, released: Date | null) {
  const now = new Date();
  return db.movie.create({
    data: {
      title: `${TAG} ${title}`,
      sortTitle: `${TAG} ${title}`,
      tmdbId: `9${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
      poster,
      releaseDate: released,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
}

async function seedEntry(movieId: number, order: number) {
  const now = new Date();
  await db.list.create({
    data: {
      userId: USER,
      movieId,
      year: YEAR,
      order,
      status: 'none',
      createdAt: now,
      updatedAt: now,
    },
  });
}

async function seedLeague(name: string) {
  const now = new Date();
  return db.league.create({
    data: { name: `${TAG} ${name}`, owner: 'x', createdAt: now, updatedAt: now },
    select: { id: true },
  });
}

/** A seat: the reader's, a named member's, or a dummy's. */
async function seedSeat(
  leagueId: number,
  seat: { userId: number } | { dummyName: string },
  year = YEAR,
) {
  const now = new Date();
  return db.draft.create({
    data: {
      leagueId,
      year,
      ...('userId' in seat
        ? { userId: seat.userId }
        : { dummy: true, dummyName: seat.dummyName }),
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
}

async function seedPick(draftId: number, movieId: number) {
  const now = new Date();
  await db.draftPick.create({
    data: { draftId, movieId: BigInt(movieId), order: 1, createdAt: now, updatedAt: now },
  });
}

async function cleanup() {
  const leagues = await db.league.findMany({
    where: { name: { startsWith: `${TAG} ` } },
    select: { id: true },
  });
  const drafts = await db.draft.findMany({
    where: { leagueId: { in: leagues.map((league) => league.id) } },
    select: { id: true },
  });
  // Picks first: `draft_picks` has no foreign key, so the other order orphans them.
  await db.draftPick.deleteMany({
    where: { draftId: { in: drafts.map((draft) => draft.id) } },
  });
  await db.draft.deleteMany({ where: { id: { in: drafts.map((draft) => draft.id) } } });
  await db.league.deleteMany({
    where: { id: { in: leagues.map((league) => league.id) } },
  });
  await db.user.deleteMany({ where: { email: { startsWith: `${TAG}-` } } });
  await db.list.deleteMany({ where: { userId: USER } });
  await db.movie.deleteMany({ where: { title: { startsWith: `${TAG} ` } } });
}

beforeEach(cleanup);
afterEach(cleanup);

afterAll(async () => {
  await db.$disconnect();
});

describe('getDraftList', () => {
  it('returns nothing for a member with no list that season', async () => {
    expect(await getDraftList(USER, YEAR)).toEqual([]);
  });

  it('joins each row to its film and reads in the stored order', async () => {
    const arrival = await seedFilm('Arrival', '/arrival.jpg', new Date('2016-11-11'));
    const moonlight = await seedFilm('Moonlight', null, null);

    // Inserted last-first, so an ordering that fell back on insertion order
    // would come back the other way round.
    await seedEntry(moonlight.id, 2);
    await seedEntry(arrival.id, 1);

    const entries = await getDraftList(USER, YEAR);

    expect(entries.map((entry) => entry.title)).toEqual([
      `${TAG} Arrival`,
      `${TAG} Moonlight`,
    ]);
    expect(entries[0]?.posterUrl).toBe('https://image.tmdb.org/t/p/w185/arrival.jpg');
    expect(entries[0]?.releaseYear).toBe(2016);
    expect(entries[0]?.status).toBe('none');
    // A film with no artwork and no release date: null, not a broken URL.
    expect(entries[1]?.posterUrl).toBeNull();
    expect(entries[1]?.releaseYear).toBeNull();
  });

  it('reads the release year in UTC, not the runner’s local zone', async () => {
    // 1 January UTC is 31 December in every zone west of it, so a local-time
    // read would report the previous year here.
    const film = await seedFilm('Nickel Boys', null, new Date('2025-01-01T00:00:00Z'));
    await seedEntry(film.id, 1);

    expect((await getDraftList(USER, YEAR))[0]?.releaseYear).toBe(2025);
  });

  it('keeps a row whose film has left the catalogue, with a placeholder', async () => {
    // `lists.movie_id` has no foreign key, so this is reachable — and a row that
    // does not render is a row nobody can remove.
    const kept = await seedFilm('Paterson', '/paterson.jpg', new Date('2016-12-28'));
    const gone = await seedFilm('Gone', '/gone.jpg', new Date('2016-01-01'));
    await seedEntry(gone.id, 1);
    await seedEntry(kept.id, 2);
    await db.movie.delete({ where: { id: gone.id } });

    const entries = await getDraftList(USER, YEAR);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.title).toBe('Film no longer in the catalogue');
    expect(entries[0]?.movieId).toBe(gone.id);
    expect(entries[0]?.posterUrl).toBeNull();
    expect(entries[0]?.releaseYear).toBeNull();
    expect(entries[1]?.title).toBe(`${TAG} Paterson`);
  });
});

/**
 * 🔴 The taken rule (the owner's "fade what someone else selected"). A film is
 * taken when a seat in one of the reader's leagues **this season** drafted it;
 * the reader's own pick is "yours", not taken; and it is only *gone* when it is
 * gone in every league the reader is seated in.
 */
describe('getDraftList — what the drafts say', () => {
  async function oneFilmOnTheList(title = 'Sinners') {
    const film = await seedFilm(title, null, null);
    await seedEntry(film.id, 1);
    return film.id;
  }

  it('marks a film another seat drafted, named as the board names it', async () => {
    const movieId = await oneFilmOnTheList();
    const league = await seedLeague('One');
    await seedSeat(league.id, { userId: USER });
    const rival = await db.user.create({
      data: { email: `${TAG}-rival@example.test`, firstName: 'Rhoda', lastName: 'Vance' },
      select: { id: true },
    });
    const seat = await seedSeat(league.id, { userId: rival.id });
    await seedPick(seat.id, movieId);

    const [entry] = await getDraftList(USER, YEAR);

    expect(entry?.drafted).toEqual({ yours: false, by: 'Rhoda Vance', gone: true });
  });

  it('names a dummy seat by its dummy name', async () => {
    const movieId = await oneFilmOnTheList();
    const league = await seedLeague('One');
    await seedSeat(league.id, { userId: USER });
    const seat = await seedSeat(league.id, { dummyName: 'Uncle Pete' });
    await seedPick(seat.id, movieId);

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toEqual({
      yours: false,
      by: 'Uncle Pete',
      gone: true,
    });
  });

  it('calls the reader’s own pick theirs, not taken', async () => {
    const movieId = await oneFilmOnTheList();
    const league = await seedLeague('One');
    const mine = await seedSeat(league.id, { userId: USER });
    await seedPick(mine.id, movieId);

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toEqual({ yours: true });
  });

  it('ignores a league the reader has no seat in', async () => {
    const movieId = await oneFilmOnTheList();
    const mine = await seedLeague('Mine');
    await seedSeat(mine.id, { userId: USER });
    const theirs = await seedLeague('Theirs');
    const seat = await seedSeat(theirs.id, { dummyName: 'Stranger' });
    await seedPick(seat.id, movieId);

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toBeUndefined();
  });

  it('ignores a past season, even in the reader’s own league', async () => {
    const movieId = await oneFilmOnTheList();
    const league = await seedLeague('One');
    await seedSeat(league.id, { userId: USER });
    await seedSeat(league.id, { userId: USER }, YEAR - 1);
    const past = await seedSeat(league.id, { dummyName: 'Last Year' }, YEAR - 1);
    await seedPick(past.id, movieId);

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toBeUndefined();
  });

  it('ignores a league the reader sat in only in a past season', async () => {
    const movieId = await oneFilmOnTheList();
    const league = await seedLeague('Left');
    await seedSeat(league.id, { userId: USER }, YEAR - 1);
    const seat = await seedSeat(league.id, { dummyName: 'Stayed On' });
    await seedPick(seat.id, movieId);

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toBeUndefined();
  });

  it('leaves a film nobody drafted alone', async () => {
    await oneFilmOnTheList();
    const league = await seedLeague('One');
    await seedSeat(league.id, { userId: USER });

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toBeUndefined();
  });

  it('in two leagues, a film taken in one is named but not gone', async () => {
    const movieId = await oneFilmOnTheList();
    const a = await seedLeague('Alpha');
    const b = await seedLeague('Bravo');
    await seedSeat(a.id, { userId: USER });
    await seedSeat(b.id, { userId: USER });
    const seat = await seedSeat(a.id, { dummyName: 'Ada' });
    await seedPick(seat.id, movieId);

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toEqual({
      yours: false,
      by: `Ada in ${TAG} Alpha`,
      gone: false,
    });

    const other = await seedSeat(b.id, { dummyName: 'Bo' });
    await seedPick(other.id, movieId);

    expect((await getDraftList(USER, YEAR))[0]?.drafted).toEqual({
      yours: false,
      by: `Ada in ${TAG} Alpha, Bo in ${TAG} Bravo`,
      gone: true,
    });
  });

  it('costs the same queries for one taken film as for five', async () => {
    // 🔴 The property, not a ceiling: an N+1 over entries or picks moves it.
    const league = await seedLeague('One');
    await seedSeat(league.id, { userId: USER });
    const seat = await seedSeat(league.id, { dummyName: 'Taker' });

    const first = await oneFilmOnTheList('Film 0');
    await seedPick(seat.id, first);
    const one = await countQueries(() => getDraftList(USER, YEAR));

    for (const index of [1, 2, 3, 4]) {
      const film = await seedFilm(`Film ${index}`, null, null);
      await seedEntry(film.id, index + 1);
      await seedPick(seat.id, film.id);
    }
    const five = await countQueries(() => getDraftList(USER, YEAR));

    expect(five.result.filter((entry) => entry.drafted)).toHaveLength(5);
    expect(one.queries).toBeGreaterThan(0);
    expect(five.queries).toBe(one.queries);
  });
});
