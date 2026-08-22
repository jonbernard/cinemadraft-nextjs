// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';

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

async function cleanup() {
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

  it('🔴 keeps a row whose film has left the catalogue, with a placeholder', async () => {
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
