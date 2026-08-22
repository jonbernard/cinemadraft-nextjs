// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

// `revalidatePath` needs a request store, which no test has. Mocking it keeps
// these tests about authorization and data.
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { addFilmToList } from './add-film';
import { removeFilmFromList } from './remove-film';
import { reorderList } from './reorder-list';
import { setListStatus } from './set-status';

/**
 * The private draft list's four writes.
 *
 * 🔴 Every refusal asserts the **database is unchanged** rather than that the
 * call came back unhappy. A guard that throws after writing is not a guard —
 * and the whole authorization story here is one sentence, "the caller's own
 * rows", so an id arriving from the client is the only attack surface there is.
 *
 * Everything is seeded, so this suite runs on CI, where there is a schema and
 * no data.
 */
const TAG = 'draft-list-actions';
const DOMAIN = '@example.test';

/**
 * A season no restored row uses, created here so the year validation has
 * something real to pass. `available_years.year` is unique, so this must not
 * collide with a genuine season.
 */
const YEAR = 2097;
/** In range for the input schema, deliberately not a season this app has. */
const NOT_A_SEASON = 2096;

type Fixture = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const now = new Date();

  const [member, other] = await Promise.all(
    ['member', 'other'].map((role) =>
      db.user.create({
        data: {
          uuid: randomUUID(),
          email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
          clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, email: true, clerkId: true },
      }),
    ),
  );

  // Titles carry the tag: the restored database has real films, and cleanup
  // that deleted by a plain title would take one.
  const films = await Promise.all(
    ['Arrival', 'Moonlight', 'Paterson'].map((title) =>
      db.movie.create({
        data: {
          title: `${TAG} ${title}`,
          sortTitle: `${TAG} ${title}`,
          tmdbId: `9${randomUUID().replace(/\D/g, '').slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, title: true, tmdbId: true },
      }),
    ),
  );

  await db.availableYear.create({
    data: { year: YEAR, isActive: false, createdAt: now, updatedAt: now },
  });

  return { member, other, films };
}

function signInAs(user: { clerkId: string | null; email: string } | null) {
  if (!user) {
    currentUser.mockResolvedValue(null);
    return;
  }
  currentUser.mockResolvedValue({
    id: user.clerkId,
    emailAddresses: [{ emailAddress: user.email, verification: { status: 'verified' } }],
    firstName: null,
    lastName: null,
    imageUrl: null,
  });
}

/** Someone's list for the seeded season, in stored order. */
async function listFor(userId: number) {
  return db.list.findMany({
    where: { userId, year: YEAR },
    select: { id: true, movieId: true, order: true, status: true },
    orderBy: { order: 'asc' },
  });
}

async function cleanup() {
  const users = await db.user.findMany({
    where: { email: { contains: `${TAG}-` } },
    select: { id: true },
  });
  const films = await db.movie.findMany({
    where: { title: { startsWith: `${TAG} ` } },
    select: { id: true },
  });
  await db.list.deleteMany({
    where: {
      OR: [
        { userId: { in: users.map((user) => user.id) } },
        { movieId: { in: films.map((film) => film.id) } },
      ],
    },
  });
  await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await db.movie.deleteMany({ where: { id: { in: films.map((film) => film.id) } } });
  await db.availableYear.deleteMany({ where: { year: { in: [YEAR, NOT_A_SEASON] } } });
}

let fixture: Fixture;

beforeEach(async () => {
  currentUser.mockReset();
  revalidatePath.mockClear();
  await cleanup();
  fixture = await seed();
});

afterEach(cleanup);

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Puts every seeded film on the signed-in caller's list, in order.
 *
 * `userId` is passed rather than inferred so the returned rows are the caller's
 * — reading somebody else's list back here is how a test can silently assert
 * against the wrong three rows.
 */
async function fillList(userId: number) {
  for (const film of fixture.films) {
    const result = await addFilmToList({ year: YEAR, movieId: film.id });
    expect(result.ok).toBe(true);
  }
  return listFor(userId);
}

describe('refusals', () => {
  it('🔴 refuses an anonymous caller on every write, and stores nothing', async () => {
    // Aimed at a real member's real rows, so a missing `requireUser()` would
    // reach the repository and succeed. Ids that match nothing would be refused
    // as NOT_FOUND with or without the session check.
    signInAs(fixture.member);
    const mine = await fillList(fixture.member.id);
    signInAs(null);
    const before = await db.list.count();

    const results = [
      await addFilmToList({ year: YEAR, movieId: fixture.films[0]?.id }),
      await removeFilmFromList({ entryId: mine[0]?.id ?? 0 }),
      await setListStatus({ entryId: mine[1]?.id ?? 0, status: 'selected' }),
      await reorderList({
        year: YEAR,
        entryIds: [...mine].reverse().map((entry) => entry.id),
      }),
    ];

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('FORBIDDEN');
    }
    expect(await db.list.count()).toBe(before);
    expect(await listFor(fixture.member.id)).toEqual(mine);
  });

  it('refuses input with no film at all', async () => {
    signInAs(fixture.member);
    const before = await db.list.count();

    const result = await addFilmToList({ year: YEAR });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID');
    expect(await db.list.count()).toBe(before);
  });
});

describe('the year, which the source ignored', () => {
  beforeEach(() => signInAs(fixture.member));

  // 🔴 Source bug 10: `POST /lists/:year` accepted any single path segment as a
  // year and then ignored it in favour of the body.
  it('refuses a year outside any plausible range', async () => {
    for (const year of [0, -2024, 1899, 9999]) {
      const result = await addFilmToList({ year, movieId: fixture.films[0]?.id });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID');
    }
    expect(await listFor(fixture.member.id)).toEqual([]);
  });

  it('refuses a plausible year the app has no season for', async () => {
    const result = await addFilmToList({
      year: NOT_A_SEASON,
      movieId: fixture.films[0]?.id,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
    expect(await db.list.count({ where: { year: NOT_A_SEASON } })).toBe(0);
  });

  it('refuses a reorder for a year the app has no season for', async () => {
    const entries = await fillList(fixture.member.id);

    const result = await reorderList({
      year: NOT_A_SEASON,
      entryIds: entries.map((entry) => entry.id),
    });

    expect(result.ok).toBe(false);
    expect((await listFor(fixture.member.id)).map((entry) => entry.order)).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('adding a film', () => {
  beforeEach(() => signInAs(fixture.member));

  it('appends it, unmarked', async () => {
    const first = fixture.films[0];
    if (!first) throw new Error('no seeded films');

    const result = await addFilmToList({ year: YEAR, movieId: first.id });

    expect(result.ok).toBe(true);
    expect(await listFor(fixture.member.id)).toEqual([
      { id: expect.any(Number), movieId: first.id, order: 1, status: 'none' },
    ]);
  });

  it('keeps the order the films were added in', async () => {
    const entries = await fillList(fixture.member.id);

    expect(entries.map((entry) => entry.movieId)).toEqual(
      fixture.films.map((film) => film.id),
    );
    expect(entries.map((entry) => entry.order)).toEqual([1, 2, 3]);
  });

  it('🔴 refuses the same film twice — a list with a duplicate cannot be ranked', async () => {
    const first = fixture.films[0];
    if (!first) throw new Error('no seeded films');
    await addFilmToList({ year: YEAR, movieId: first.id });

    const again = await addFilmToList({ year: YEAR, movieId: first.id });

    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.code).toBe('CONFLICT');
    expect(await listFor(fixture.member.id)).toHaveLength(1);
  });

  it('refuses a local film id that does not exist', async () => {
    const result = await addFilmToList({ year: YEAR, movieId: 999_999_999 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
    expect(await listFor(fixture.member.id)).toEqual([]);
  });

  it('revalidates the page', async () => {
    await addFilmToList({ year: YEAR, movieId: fixture.films[0]?.id });

    expect(revalidatePath.mock.calls.map((call) => call.at(0))).toContain('/list');
  });
});

describe('reordering', () => {
  beforeEach(() => signInAs(fixture.member));

  it('rewrites the positions as 1..N in the order given', async () => {
    const entries = await fillList(fixture.member.id);
    const reversed = [...entries].reverse().map((entry) => entry.id);

    const result = await reorderList({ year: YEAR, entryIds: reversed });

    expect(result.ok).toBe(true);
    expect((await listFor(fixture.member.id)).map((entry) => entry.id)).toEqual(reversed);
  });

  it('🔴 refuses a partial list rather than renumbering half of it', async () => {
    // Renumbering some rows and leaving the rest would leave two entries
    // sharing a position, which no single sequence can render.
    const entries = await fillList(fixture.member.id);

    const result = await reorderList({
      year: YEAR,
      entryIds: [entries[1]?.id ?? 0, entries[0]?.id ?? 0],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFLICT');
    expect((await listFor(fixture.member.id)).map((entry) => entry.order)).toEqual([
      1, 2, 3,
    ]);
  });

  it('refuses a list with a repeated id', async () => {
    const entries = await fillList(fixture.member.id);
    const first = entries[0]?.id ?? 0;

    const result = await reorderList({
      year: YEAR,
      entryIds: [first, first, entries[2]?.id ?? 0],
    });

    expect(result.ok).toBe(false);
    expect((await listFor(fixture.member.id)).map((entry) => entry.order)).toEqual([
      1, 2, 3,
    ]);
  });

  it('🔴 refuses a list containing somebody else’s entry', async () => {
    const mine = await fillList(fixture.member.id);
    signInAs(fixture.other);
    const theirs = await fillList(fixture.other.id);
    signInAs(fixture.member);

    const result = await reorderList({
      year: YEAR,
      entryIds: [...mine.slice(1).map((entry) => entry.id), theirs[0]?.id ?? 0],
    });

    expect(result.ok).toBe(false);
    expect((await listFor(fixture.member.id)).map((entry) => entry.id)).toEqual(
      mine.map((entry) => entry.id),
    );
    expect((await listFor(fixture.other.id)).map((entry) => entry.order)).toEqual([
      1, 2, 3,
    ]);
  });
});

describe('marking an entry', () => {
  it('sets the state it is given, and can set it back', async () => {
    signInAs(fixture.member);
    const entries = await fillList(fixture.member.id);
    const target = entries[1]?.id ?? 0;

    expect((await setListStatus({ entryId: target, status: 'unavailable' })).ok).toBe(
      true,
    );
    expect((await listFor(fixture.member.id))[1]?.status).toBe('unavailable');

    expect((await setListStatus({ entryId: target, status: 'none' })).ok).toBe(true);
    expect((await listFor(fixture.member.id))[1]?.status).toBe('none');
  });

  it('🔴 cannot mark somebody else’s entry', async () => {
    signInAs(fixture.other);
    const theirs = await fillList(fixture.other.id);
    signInAs(fixture.member);

    const result = await setListStatus({
      entryId: theirs[0]?.id ?? 0,
      status: 'selected',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
    expect((await listFor(fixture.other.id))[0]?.status).toBe('none');
  });
});

describe('removing an entry', () => {
  it('removes it', async () => {
    signInAs(fixture.member);
    const entries = await fillList(fixture.member.id);

    const result = await removeFilmFromList({ entryId: entries[0]?.id ?? 0 });

    expect(result.ok).toBe(true);
    expect(await listFor(fixture.member.id)).toHaveLength(2);
  });

  it('🔴 cannot remove somebody else’s entry', async () => {
    // The source deleted by the id in the URL with no owner clause at all
    // (`Lists.deleteById`), so anyone signed in could delete any row on the
    // table. Here the caller's id is part of the WHERE clause.
    signInAs(fixture.other);
    const theirs = await fillList(fixture.other.id);
    signInAs(fixture.member);

    const result = await removeFilmFromList({ entryId: theirs[0]?.id ?? 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
    expect(await listFor(fixture.other.id)).toHaveLength(3);
  });

  it('reports a NOT_FOUND for an entry that is already gone', async () => {
    signInAs(fixture.member);

    const result = await removeFilmFromList({ entryId: 999_999_999 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });
});
