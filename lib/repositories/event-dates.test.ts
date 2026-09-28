// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getSeasonMoments } from '@/lib/services/moments';
import { inSeason } from '@/lib/utils/season-window';
import { applyDates } from '@/scripts/award-import.mjs';

import { eventDateRepository } from './event-dates';

/**
 * Per-season show dates (P16.T18, D134). Seeds its own show in 2987, so it
 * runs on CI.
 *
 * 🔴 CI's database is migrations plus a minimal seed with no `events`, so the
 * M3 backfill's INSERT (which joins on `events`) writes nothing there. The
 * backfill is therefore checked from the migration's own literals, which are
 * what every real database gets, and the table is checked through a fresh
 * query as well for wherever it has rows.
 */
const TAG = 'event-dates-test';
const YEAR = 2987;
const MIGRATION = join(
  process.cwd(),
  'prisma/migrations/20260929090000_event_dates/migration.sql',
);

const ROW =
  /^\s*\((\d{4}), '(\w+)',\s+DATE '([\d-]+)', (\w+),\s+(?:DATE '([\d-]+)'|NULL),\s+(\w+)\),?$/gm;

function backfill() {
  return [...readFileSync(MIGRATION, 'utf8').matchAll(ROW)].map((m) => ({
    year: Number(m[1]),
    abbr: m[2] as string,
    nom: Date.parse(m[3] as string),
    awards: m[5] ? Date.parse(m[5]) : null,
  }));
}

async function cleanup() {
  const events = await db.event.findMany({
    where: { abbreviation: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = events.map((event) => event.id);
  await db.eventDate.deleteMany({ where: { eventId: { in: ids } } });
  await db.event.deleteMany({ where: { id: { in: ids } } });
}

/** A show whose `events` columns hold 2026's dates, and a stored row for YEAR. */
async function seed() {
  const now = new Date();
  const event = await db.event.create({
    data: {
      name: `${TAG} Show`,
      abbreviation: `${TAG}-show`,
      nomDate: BigInt(Date.UTC(2026, 0, 10)),
      awardsDate: BigInt(Date.UTC(2026, 2, 1)),
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true },
  });
  await db.eventDate.create({
    data: {
      year: YEAR,
      eventId: event.id,
      nomDate: BigInt(Date.UTC(YEAR, 0, 12)),
      nomTime: BigInt(46_800_000),
      awardsDate: BigInt(Date.UTC(YEAR, 1, 20)),
    },
  });
  return event.id;
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe('the M3 backfill', () => {
  const rows = backfill();

  it('has every show for every season 2017–2026, once', () => {
    expect(rows).toHaveLength(120);
    const keys = new Set(rows.map((row) => `${row.year} ${row.abbr}`));
    expect(keys.size).toBe(120);
    for (let year = 2017; year <= 2026; year += 1) {
      expect(
        rows
          .filter((row) => row.year === year)
          .map((row) => row.abbr)
          .sort(),
      ).toEqual([
        'ace',
        'adg',
        'afi',
        'asc',
        'bafta',
        'dga',
        'gg',
        'oscars',
        'pga',
        'raz',
        'sag',
        'wga',
      ]);
    }
  });

  it('dates every moment inside its own season, nominations before awards', () => {
    for (const row of rows) {
      const where = `${row.year} ${row.abbr}`;
      expect(inSeason(row.nom, row.year), `${where} nominations`).toBe(true);
      // The AFI has no ceremony (D129), and only the AFI.
      expect(row.awards === null, `${where} awards`).toBe(row.abbr === 'afi');
      if (row.awards === null) continue;
      expect(inSeason(row.awards, row.year), `${where} awards`).toBe(true);
      expect(row.nom, `${where} order`).toBeLessThan(row.awards);
    }
  });

  it('holds on every stored row too', async () => {
    const stored = await db.eventDate.findMany({
      select: { year: true, nomDate: true, awardsDate: true },
    });
    for (const row of stored) {
      if (row.nomDate != null) expect(inSeason(Number(row.nomDate), row.year)).toBe(true);
      if (row.awardsDate != null)
        expect(inSeason(Number(row.awardsDate), row.year)).toBe(true);
      if (row.nomDate != null && row.awardsDate != null)
        expect(row.nomDate).toBeLessThan(row.awardsDate);
    }
  });
});

describe('eventDateRepository.findByYear', () => {
  it("returns a show's row for its year, as numbers", async () => {
    const eventId = await seed();
    expect((await eventDateRepository.findByYear(YEAR)).get(eventId)).toEqual({
      nomDate: Date.UTC(YEAR, 0, 12),
      nomTime: 46_800_000,
      awardsDate: Date.UTC(YEAR, 1, 20),
      awardsTime: null,
    });
  });

  it('has nothing for a year the show has no row in', async () => {
    const eventId = await seed();
    expect((await eventDateRepository.findByYear(YEAR - 1)).has(eventId)).toBe(false);
  });
});

describe('getSeasonMoments', () => {
  it('dates a season from its stored row, not the events columns', async () => {
    const eventId = await seed();
    const moments = await getSeasonMoments(YEAR);
    const date = (phase: string) =>
      moments.find((m) => m.eventId === eventId && m.phase === phase)?.date;
    expect(date('nominations')).toBe(Date.UTC(YEAR, 0, 12));
    expect(date('ceremony')).toBe(Date.UTC(YEAR, 1, 20));
  });
});

describe("award-import's set-dates", () => {
  // Real SQL against the real unique index: a fake client cannot show that a
  // re-run updates the row rather than adding a second one.
  it('keeps one row per show per season, and a re-run updates it', async () => {
    const eventId = await seed();
    await db.eventDate.deleteMany({ where: { eventId } });
    const show = {
      id: eventId,
      abbreviation: `${TAG}-show`,
      hasCeremony: true,
      nomDate: null,
      awardsDate: null,
      nomCurrent: false,
      awardsCurrent: false,
      nomTimeOfDay: 46_800_000,
      awardsTimeOfDay: 90_000_000,
    };
    const plan = (nominations: string) => ({
      kind: 'dates',
      year: YEAR,
      sources: ['https://example.test'],
      shows: [
        {
          abbreviation: show.abbreviation,
          recheck: true,
          nominations: { date: nominations, time: '08:00' },
          awards: { date: `${YEAR}-03-01`, time: '20:00' },
        },
      ],
    });
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const state = { activeYear: YEAR, shows: [show] };
      const options = { commit: true, secret: 'test' };
      await applyDates(client, plan(`${YEAR}-01-10`), state, options);
      await applyDates(client, plan(`${YEAR}-01-17`), state, options);
    } finally {
      await client.end();
    }
    const rows = await db.eventDate.findMany({ where: { eventId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      year: YEAR,
      nomDate: BigInt(Date.UTC(YEAR, 0, 17)),
      awardsDate: BigInt(Date.UTC(YEAR, 2, 1)),
    });
  });
});
