// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { pointsForMovieIds } from '@/lib/services/scoring';
import { attachNominee } from './attach-nominee';
import { removeNominee } from './remove-nominee';
import { setWinner } from './set-winner';

/**
 * 🔴 These three actions write the **inputs to scoring**. A bad write here
 * moves every league's standings at once (§12), and the source app left the
 * equivalent endpoints open to anyone on the internet — no middleware, no role
 * check (`PARITY.md` bug 1).
 *
 * So the refusals come first and are asserted hardest: each one checks the
 * **database is unchanged**, not merely that the call came back unhappy.
 *
 * Everything is seeded, so this suite runs on CI where there is a schema and
 * no data.
 */
const TAG = 'award-actions';
const DOMAIN = '@example.test';
const YEAR = 2995;

type Fixture = Awaited<ReturnType<typeof seed>>;

async function seed() {
  const now = new Date();

  const [admin, member] = await Promise.all(
    (['admin', 'user'] as const).map((role) =>
      db.user.create({
        data: {
          uuid: randomUUID(),
          email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
          clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
          role,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, email: true, clerkId: true },
      }),
    ),
  );

  const event = await db.event.create({
    data: {
      name: `${TAG} show`,
      abbreviation: `${TAG}-abbr`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, abbreviation: true },
  });

  // A real point tier, so a win is worth something checkable.
  const points = await db.point.create({
    data: { points: 7, level: `${TAG}-level`, tier: 3, createdAt: now, updatedAt: now },
    select: { id: true, points: true },
  });

  const [category, actingCategory] = await Promise.all([
    db.award.create({
      data: {
        name: `${TAG} Best Picture`,
        eventId: event.id,
        // 🔴 The foreign key into points.id, not a value (D41).
        points: points.id,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true, name: true },
    }),
    db.award.create({
      data: {
        name: `${TAG} Best Actor`,
        eventId: event.id,
        points: points.id,
        requiresNomineeName: true,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true, name: true },
    }),
  ]);

  const films = await Promise.all(
    ['Alpha', 'Bravo', 'Charlie'].map((title) =>
      db.movie.create({
        data: {
          title: `${TAG} ${title}`,
          sortTitle: `${TAG} ${title}`,
          createdAt: now,
          updatedAt: now,
        },
        select: { id: true, title: true },
      }),
    ),
  );

  return { admin, member, event, points, category, actingCategory, films };
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

async function nominationsFor(awardId: number) {
  const rows = await db.nomination.findMany({
    where: { awardId: BigInt(awardId) },
    select: { id: true, movieId: true, year: true, detailName: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => ({ ...row, movieId: Number(row.movieId) }));
}

async function winnersFor(awardId: number) {
  const rows = await db.winner.findMany({
    where: { awardId: BigInt(awardId) },
    select: { id: true, movieId: true, year: true },
  });
  return rows.map((row) => ({ ...row, movieId: Number(row.movieId) }));
}

async function cleanup() {
  const events = await db.event.findMany({
    where: { abbreviation: { startsWith: TAG } },
    select: { id: true },
  });
  const awards = await db.award.findMany({
    where: { eventId: { in: events.map((event) => event.id) } },
    select: { id: true },
  });
  const awardIds = awards.map((award) => BigInt(award.id));

  await db.winner.deleteMany({ where: { awardId: { in: awardIds } } });
  await db.nomination.deleteMany({ where: { awardId: { in: awardIds } } });
  await db.award.deleteMany({ where: { id: { in: awards.map((a) => a.id) } } });
  await db.event.deleteMany({ where: { id: { in: events.map((e) => e.id) } } });
  await db.point.deleteMany({ where: { level: { startsWith: TAG } } });
  await db.movie.deleteMany({ where: { title: { startsWith: `${TAG} ` } } });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
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

describe('attachNominee — refusals', () => {
  it('🔴 refuses a signed-out caller and writes nothing', async () => {
    // The exact hole in the source app: no session, and a nomination lands.
    signInAs(null);

    const result = await attachNominee({
      awardId: fixture.category.id,
      movieId: fixture.films[0]?.id as number,
      year: YEAR,
    });

    expect(result.ok).toBe(false);
    expect(await nominationsFor(fixture.category.id)).toEqual([]);
  });

  it('🔴 refuses a signed-in non-admin', async () => {
    // A league member is not an awards administrator. Every member of every
    // league would otherwise be able to move everyone's standings.
    signInAs(fixture.member);

    const result = await attachNominee({
      awardId: fixture.category.id,
      movieId: fixture.films[0]?.id as number,
      year: YEAR,
    });

    expect(result.ok).toBe(false);
    expect(await nominationsFor(fixture.category.id)).toEqual([]);
  });

  it('rejects a film that does not exist', async () => {
    signInAs(fixture.admin);

    const result = await attachNominee({
      awardId: fixture.category.id,
      movieId: 999_999_999,
      year: YEAR,
    });

    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    expect(await nominationsFor(fixture.category.id)).toEqual([]);
  });

  it('rejects input that is not a nomination', async () => {
    signInAs(fixture.admin);

    expect(await attachNominee({ awardId: 0, movieId: -1, year: 0 })).toMatchObject({
      ok: false,
      code: 'INVALID',
    });
  });
});

describe('attachNominee', () => {
  it('records the nomination', async () => {
    signInAs(fixture.admin);

    const result = await attachNominee({
      awardId: fixture.category.id,
      movieId: fixture.films[0]?.id as number,
      year: YEAR,
    });

    expect(result.ok).toBe(true);
    expect(await nominationsFor(fixture.category.id)).toEqual([
      {
        id: expect.any(Number),
        movieId: fixture.films[0]?.id,
        // 🔴 TEXT, unlike every other year column in the schema.
        year: String(YEAR),
        detailName: null,
      },
    ]);
  });

  it('🔴 refuses a duplicate rather than doubling the film’s points', async () => {
    // A double-click during a live announcement. Two nominations means the
    // film scores this category twice.
    signInAs(fixture.admin);
    const movieId = fixture.films[0]?.id as number;
    await attachNominee({ awardId: fixture.category.id, movieId, year: YEAR });

    const result = await attachNominee({
      awardId: fixture.category.id,
      movieId,
      year: YEAR,
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await nominationsFor(fixture.category.id)).toHaveLength(1);
  });

  it('allows the same film in a different category', async () => {
    signInAs(fixture.admin);
    const movieId = fixture.films[0]?.id as number;
    await attachNominee({ awardId: fixture.category.id, movieId, year: YEAR });

    const result = await attachNominee({
      awardId: fixture.actingCategory.id,
      movieId,
      year: YEAR,
      detailName: 'Someone',
    });

    expect(result.ok).toBe(true);
  });

  it('🔴 refuses to leave a person-nominating category anonymous', async () => {
    // Acting and craft categories nominate a *person*. A null there renders as
    // four identical posters of the same film with a blank beneath one.
    signInAs(fixture.admin);

    const result = await attachNominee({
      awardId: fixture.actingCategory.id,
      movieId: fixture.films[0]?.id as number,
      year: YEAR,
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await nominationsFor(fixture.actingCategory.id)).toEqual([]);
  });

  it('records the person when the category names one', async () => {
    signInAs(fixture.admin);

    await attachNominee({
      awardId: fixture.actingCategory.id,
      movieId: fixture.films[0]?.id as number,
      year: YEAR,
      detailName: 'Cillian Murphy',
      detailCharacter: 'J. Robert Oppenheimer',
    });

    const [nomination] = await nominationsFor(fixture.actingCategory.id);
    expect(nomination?.detailName).toBe('Cillian Murphy');
  });
});

describe('removeNominee', () => {
  async function nominate(movieIndex = 0) {
    signInAs(fixture.admin);
    await attachNominee({
      awardId: fixture.category.id,
      movieId: fixture.films[movieIndex]?.id as number,
      year: YEAR,
    });
    const [nomination] = await nominationsFor(fixture.category.id);
    return nomination as { id: number; movieId: number };
  }

  it('🔴 refuses a non-admin and leaves the nomination in place', async () => {
    const nomination = await nominate();
    signInAs(fixture.member);

    const result = await removeNominee(nomination.id);

    expect(result.ok).toBe(false);
    expect(await nominationsFor(fixture.category.id)).toHaveLength(1);
  });

  it('🔴 refuses a signed-out caller', async () => {
    const nomination = await nominate();
    signInAs(null);

    const result = await removeNominee(nomination.id);

    expect(result.ok).toBe(false);
    expect(await nominationsFor(fixture.category.id)).toHaveLength(1);
  });

  it('removes it', async () => {
    const nomination = await nominate();
    signInAs(fixture.admin);

    expect(await removeNominee(nomination.id)).toMatchObject({ ok: true });
    expect(await nominationsFor(fixture.category.id)).toEqual([]);
  });

  it('🔴 takes the win with it when the removed film had won', async () => {
    // Otherwise the category is won by a film it does not list, and — because
    // a win pays the award's points a second time — that film keeps scoring
    // for a nomination the app no longer believes in.
    const nomination = await nominate();
    signInAs(fixture.admin);
    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: nomination.movieId,
    });
    expect(await winnersFor(fixture.category.id)).toHaveLength(1);

    await removeNominee(nomination.id);

    expect(await winnersFor(fixture.category.id)).toEqual([]);
  });
});

describe('setWinner — refusals', () => {
  async function nominateAll() {
    signInAs(fixture.admin);
    for (const film of fixture.films.slice(0, 2)) {
      await attachNominee({ awardId: fixture.category.id, movieId: film.id, year: YEAR });
    }
  }

  it('🔴 refuses a signed-out caller and records no winner', async () => {
    // In the source app this endpoint decided who won Best Picture, with no
    // session required.
    await nominateAll();
    signInAs(null);

    const result = await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[0]?.id as number,
    });

    expect(result.ok).toBe(false);
    expect(await winnersFor(fixture.category.id)).toEqual([]);
  });

  it('🔴 refuses a signed-in non-admin', async () => {
    await nominateAll();
    signInAs(fixture.member);

    const result = await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[0]?.id as number,
    });

    expect(result.ok).toBe(false);
    expect(await winnersFor(fixture.category.id)).toEqual([]);
  });

  it('🔴 refuses a film that is not nominated in the category', async () => {
    // A win pays the award's points on top of the nomination's, so a winner
    // that was never nominated would hold points no page could explain.
    await nominateAll();
    signInAs(fixture.admin);

    const result = await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[2]?.id as number,
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await winnersFor(fixture.category.id)).toEqual([]);
  });
});

describe('setWinner', () => {
  async function nominateAll() {
    signInAs(fixture.admin);
    for (const film of fixture.films.slice(0, 2)) {
      await attachNominee({ awardId: fixture.category.id, movieId: film.id, year: YEAR });
    }
  }

  it('records the winner', async () => {
    await nominateAll();

    const result = await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[0]?.id as number,
    });

    expect(result).toMatchObject({ ok: true });
    expect(await winnersFor(fixture.category.id)).toEqual([
      { id: expect.any(Number), movieId: fixture.films[0]?.id, year: YEAR },
    ]);
  });

  it('🔴 correcting replaces, it does not add a second winner', async () => {
    // Winners are entered live from a stage announcement, so a correction is
    // ordinary (§12). Two rows would mean two winning films — and a win pays
    // the award's points again, so it would pay them twice.
    await nominateAll();
    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[0]?.id as number,
    });

    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[1]?.id as number,
    });

    expect(await winnersFor(fixture.category.id)).toEqual([
      { id: expect.any(Number), movieId: fixture.films[1]?.id, year: YEAR },
    ]);
  });

  it('clears the winner when the announcement was misheard', async () => {
    await nominateAll();
    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[0]?.id as number,
    });

    const result = await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: null,
    });

    expect(result).toMatchObject({ ok: true });
    expect(await winnersFor(fixture.category.id)).toEqual([]);
  });

  it('revalidates the show so the seal moves', async () => {
    await nominateAll();
    revalidatePath.mockClear();

    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: fixture.films[0]?.id as number,
    });

    expect(revalidatePath).toHaveBeenCalledWith(
      `/award-shows/${fixture.event.abbreviation}`,
      'layout',
    );
  });
});

describe('🔴 the phase gate — a correction leaves no stale points', () => {
  it('moves the points from the old winner to the new one', async () => {
    // Scoring is computed on read today (D41), so this passes by construction
    // — and that is precisely why it is written now. Phase 9 materializes
    // totals, and this test is the constraint it must not break. A test that
    // is easy to pass today is the one you want in place before you make it
    // hard.
    signInAs(fixture.admin);
    const [alpha, bravo] = fixture.films;
    for (const film of [alpha, bravo]) {
      await attachNominee({
        awardId: fixture.category.id,
        movieId: film?.id as number,
        year: YEAR,
      });
    }

    const value = fixture.points.points as number;
    const ids = [alpha?.id as number, bravo?.id as number];

    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: alpha?.id as number,
    });
    const before = await pointsForMovieIds(ids, YEAR);

    // Nominated only: the award's value once. Nominated and won: twice.
    expect(before.get(alpha?.id as number)).toBe(value * 2);
    expect(before.get(bravo?.id as number)).toBe(value);

    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: bravo?.id as number,
    });
    const after = await pointsForMovieIds(ids, YEAR);

    expect(after.get(alpha?.id as number)).toBe(value);
    expect(after.get(bravo?.id as number)).toBe(value * 2);
  });

  it('clearing a winner returns the points it paid', async () => {
    signInAs(fixture.admin);
    const alpha = fixture.films[0];
    await attachNominee({
      awardId: fixture.category.id,
      movieId: alpha?.id as number,
      year: YEAR,
    });
    await setWinner({
      awardId: fixture.category.id,
      year: YEAR,
      movieId: alpha?.id as number,
    });

    await setWinner({ awardId: fixture.category.id, year: YEAR, movieId: null });
    const after = await pointsForMovieIds([alpha?.id as number], YEAR);

    expect(after.get(alpha?.id as number)).toBe(fixture.points.points);
  });
});
