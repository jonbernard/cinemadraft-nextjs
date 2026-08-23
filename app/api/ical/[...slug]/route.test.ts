// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { GET } from './route';

const DOMAIN = '@icaltest.example';

function request(path: string) {
  return new NextRequest(`https://next.cinemadraft.com${path}`);
}

function params(slug: string[]) {
  return { params: Promise.resolve({ slug }) };
}

async function cleanup() {
  await db.event.deleteMany({ where: { name: { contains: 'Ical Test' } } });
  await db.league.deleteMany({ where: { name: { contains: 'Ical Test' } } });
  await db.user.deleteMany({ where: { email: { contains: DOMAIN } } });
}

afterEach(cleanup);
afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe('GET /api/ical', () => {
  it('serves every show when no slug is given, with the right content type', async () => {
    const event = await db.event.create({
      data: {
        name: 'Ical Test Awards',
        abbreviation: `icaltest-${randomUUID().slice(0, 8)}`,
        nomDate: BigInt(Date.UTC(2027, 0, 1)),
        nomTime: BigInt(0),
        nomDuration: BigInt(60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await GET(request('/api/ical'), params([]));
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect(body).toContain('SUMMARY:Ical Test Awards Nominations');
    expect(body).toContain(
      `URL:https://next.cinemadraft.com/award-shows/${event.abbreviation}`,
    );
  });

  it('scopes to one show when the slug names its abbreviation', async () => {
    const abbr = `icaltest-${randomUUID().slice(0, 8)}`;
    await db.event.create({
      data: {
        name: 'Ical Test Scoped Show',
        abbreviation: abbr,
        awardsDate: BigInt(Date.UTC(2027, 5, 1)),
        awardsTime: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const other = await db.event.create({
      data: {
        name: 'Ical Test Other Show',
        abbreviation: `icaltest-${randomUUID().slice(0, 8)}`,
        awardsDate: BigInt(Date.UTC(2027, 5, 2)),
        awardsTime: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await GET(request(`/api/ical/${abbr}`), params([abbr]));
    const body = await response.text();

    expect(body).toContain('SUMMARY:Ical Test Scoped Show Awards');
    expect(body).not.toContain(other.name);
  });

  it('404s for an abbreviation that does not exist', async () => {
    const response = await GET(
      request('/api/ical/does-not-exist'),
      params(['does-not-exist']),
    );
    expect(response.status).toBe(404);
  });

  it('404s for a slug with more than one segment', async () => {
    const response = await GET(request('/api/ical/a/b'), params(['a', 'b']));
    expect(response.status).toBe(404);
  });

  it('🔴 never emits a member name, league name, email or uuid — even where a wrong join could reach one', async () => {
    // Real, joinable rows: a league whose name is a secret, and a user whose
    // email and uuid are secrets. Nothing in this route queries either table,
    // but the property under test is the *output*, not the absence of a call
    // to `db.league`/`db.user` — a future change that joined through events
    // for "who's watching" would have to smuggle this data past this
    // assertion, not just past a code review.
    const secretUuid = randomUUID();
    await db.league.create({
      data: {
        name: 'Ical Test Secret League Alpha',
        owner: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await db.user.create({
      data: {
        uuid: secretUuid,
        firstName: 'Secret',
        lastName: 'Member',
        email: `secret-member${DOMAIN}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await db.event.create({
      data: {
        name: 'Ical Test Awards',
        abbreviation: `icaltest-${randomUUID().slice(0, 8)}`,
        nomDate: BigInt(Date.UTC(2027, 0, 1)),
        nomTime: BigInt(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await GET(request('/api/ical'), params([]));
    const body = await response.text();

    expect(body).not.toContain('Secret');
    expect(body).not.toContain('Member');
    expect(body).not.toContain('secret-member');
    expect(body).not.toContain(DOMAIN);
    expect(body).not.toContain(secretUuid);
  });
});
