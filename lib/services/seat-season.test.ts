// @vitest-environment node

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getSeatSeasonView } from './season-ledger';

/**
 * The seat page's guard (P16.T21): a draft id is a sequence number, so the
 * page must refuse a seat of another league rather than render it under this
 * league's name. Own scratch leagues in 2990; seeded, so it runs on CI.
 */
const TAG = 'seat-season-test';
const YEAR = 2990;

async function cleanup() {
  const leagues = await db.league.findMany({
    where: { name: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = leagues.map((league) => league.id);
  await db.draft.deleteMany({ where: { leagueId: { in: ids } } });
  await db.league.deleteMany({ where: { id: { in: ids } } });
}

async function league(name: string) {
  const now = new Date();
  const created = await db.league.create({
    data: { name: `${TAG} ${name}`, owner: '[]', createdAt: now, updatedAt: now },
    select: { id: true },
  });
  const draft = await db.draft.create({
    data: {
      leagueId: created.id,
      year: YEAR,
      group: 1,
      order: 1,
      dummy: true,
      dummyName: `${TAG} ${name} seat`,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  return { leagueId: created.id, draftId: draft.id };
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe('getSeatSeasonView', () => {
  it('opens a seat of this league, in its own season', async () => {
    const own = await league('one');
    const view = await getSeatSeasonView(own.leagueId, own.draftId, null);
    expect(view?.year).toBe(YEAR);
    expect(view?.seat).toMatchObject({ draftId: own.draftId, name: `${TAG} one seat` });
  });

  it('refuses a seat of another league', async () => {
    const one = await league('one');
    const two = await league('two');
    expect(await getSeatSeasonView(one.leagueId, two.draftId, null)).toBeNull();
  });

  it('refuses a draft that does not exist', async () => {
    const one = await league('one');
    expect(await getSeatSeasonView(one.leagueId, 2_000_000_000, null)).toBeNull();
  });
});
