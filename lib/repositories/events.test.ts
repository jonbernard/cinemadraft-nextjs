// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { loadFixture } from '@/test/fixtures';

import { eventRepository } from './events';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * An event as the source API returned it from `GET /events`.
 *
 * Note what is missing: the controller eager-loads `awards` on every read, and
 * the route then `R.omit`s them again before responding. The list endpoint is
 * therefore a plain event, and awards are their own repository.
 */
type FixtureEvent = {
  id: number;
  fbId: string | null;
  name: string;
  abbreviation: string;
  image: string | null;
  liveResults: boolean | null;
  nomActive: boolean | null;
  nomDate: number | null;
  nomTime: number | null;
  nomDuration: number | null;
  awardsActive: boolean | null;
  awardsDate: number | null;
  awardsTime: number | null;
  awardsDuration: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const events = loadFixture<FixtureEvent[]>('events');
const oscars = loadFixture<FixtureEvent & { awards: unknown[] }>('event-by-abbr');

describe('eventRepository.findById', () => {
  it('returns the event', async () => {
    const event = await eventRepository.findById(oscars.id);
    expect(event.abbreviation).toBe('oscars');
    expect(event.name).toBe('Academy of Motion Picture Arts and Sciences');
  });

  it('throws NotFoundError for an id that does not exist', async () => {
    await expect(eventRepository.findById(999_999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(eventRepository.findById(999_999)).rejects.toThrow(
      'event 999999 not found',
    );
  });
});

describe('eventRepository.findByAbbreviation', () => {
  it('returns the event', async () => {
    const event = await eventRepository.findByAbbreviation('bafta');
    expect(event?.name).toBe('British Academy of Film and Television Arts');
  });

  it('returns null when absent', async () => {
    // Unlike findById, this one legitimately misses: `/award-shows/[abbr]` is
    // a public URL and anyone can type a slug that is not an award show.
    expect(await eventRepository.findByAbbreviation('nope')).toBeNull();
  });

  it('matches exactly, not case-insensitively', async () => {
    // The source app compared the column directly, and every stored
    // abbreviation is lowercase. Widening this would need a real decision
    // about the canonical URL, so it stays a strict match.
    expect(await eventRepository.findByAbbreviation('OSCARS')).toBeNull();
  });
});

describe('the DTO matches the captured contract', () => {
  it('carries exactly the fields the source API returned', async () => {
    const expected = events[0];
    if (!expected) throw new Error('events fixture is empty');

    const event = await eventRepository.findById(expected.id);

    // 🔴 Plus `focusedAwardId`, which the source API never returned because
    // the source had no such column — the selection was a socket.io message
    // and lived nowhere (P14.T12). Named here rather than the assertion being
    // loosened, so the next column added still has to be argued for, the way
    // `movies.accentHex` is named in `movies.test.ts`.
    expect(Object.keys(event).sort()).toEqual(
      [...Object.keys(expected), 'focusedAwardId'].sort(),
    );
  });

  it('does not carry the awards the by-abbreviation endpoint nested', async () => {
    // `GET /events/:abbreviation` returned the event with its awards, each
    // with its points, nominations and the nominated movie — a four-level
    // graph. Composing that is a service concern; this layer returns one row.
    expect(oscars.awards.length).toBeGreaterThan(0);

    const event = await eventRepository.findByAbbreviation('oscars');
    expect(event).not.toHaveProperty('awards');
  });

  it('matches the captured values field for field', async () => {
    const expected = events[0];
    if (!expected) throw new Error('events fixture is empty');

    const event = await eventRepository.findById(expected.id);

    expect(event.id).toBe(expected.id);
    expect(event.fbId).toBe(expected.fbId);
    expect(event.name).toBe(expected.name);
    expect(event.abbreviation).toBe(expected.abbreviation);
    expect(event.liveResults).toBe(expected.liveResults);
    expect(event.nomActive).toBe(expected.nomActive);
    expect(event.nomDate).toBe(expected.nomDate);
    expect(event.nomTime).toBe(expected.nomTime);
    expect(event.nomDuration).toBe(expected.nomDuration);
    expect(event.awardsActive).toBe(expected.awardsActive);
    expect(event.awardsDate).toBe(expected.awardsDate);
    expect(event.awardsTime).toBe(expected.awardsTime);
    expect(event.awardsDuration).toBe(expected.awardsDuration);
    expect(event.createdAt?.toISOString()).toBe(expected.createdAt);
    expect(event.updatedAt?.toISOString()).toBe(expected.updatedAt);
  });

  it('normalizes the bigint millisecond columns to number', async () => {
    // nom_date, nom_time, nom_duration and their awards counterparts are
    // bigint in Postgres, so Prisma hands back JS bigint. A bigint in a DTO
    // throws on JSON.stringify — it would take down every Server Component
    // that passes an event to a Client Component. The values are epoch
    // milliseconds and day offsets, far inside Number.MAX_SAFE_INTEGER, and
    // the source API served them as JSON numbers. Number is the contract.
    const event = await eventRepository.findById(oscars.id);

    expect(typeof event.nomDate).toBe('number');
    expect(typeof event.awardsDuration).toBe('number');
    expect(Number.isSafeInteger(event.nomDate)).toBe(true);
    expect(() => JSON.stringify(event)).not.toThrow();
  });

  it('keeps a null duration null rather than folding it to zero', async () => {
    // The obvious Number(bigint | null) conversion turns null into 0, and
    // zero is a meaningful duration: the calendar builder falls back to a
    // 30-minute block only when the duration is absent.
    const withoutDuration = events.find((event) => event.nomDuration === null);
    if (!withoutDuration) throw new Error('no event with a null nomDuration');

    const event = await eventRepository.findById(withoutDuration.id);
    expect(event.nomDuration).toBeNull();
  });

  it('returns Date objects, not the strings JSON gave us', async () => {
    const event = await eventRepository.findById(oscars.id);
    expect(event.createdAt).toBeInstanceOf(Date);
  });

  it('returns the stored image URL, which the fixture does not preserve', async () => {
    // Every `image` field is rewritten by scripts/scrub-fixtures.mjs, because
    // the same key holds user avatar URLs elsewhere. The fixture's
    // example.test URL is the scrubber's, not the source API's — this only
    // asserts the DTO passes through whatever the database actually holds,
    // rather than the scrubbed placeholder. The Blob shape that
    // `scripts/upload-award-logos.mjs` (P11.T3) writes belongs to
    // `e2e/award-shows.spec.ts`, where reading production-copy data is
    // expected; a fresh clone that restores a dump and runs `npm test` has
    // never run that script, so asserting the Blob shape here would fail on
    // exactly that clean setup.
    const event = await eventRepository.findById(oscars.id);

    expect(oscars.image).toMatch(/^https:\/\/example\.test\//);
    expect(event.image).not.toMatch(/^https:\/\/example\.test\//);
  });

  it('returns no Prisma internals', async () => {
    const event = await eventRepository.findById(oscars.id);
    expect(Object.getPrototypeOf(event)).toBe(Object.prototype);
  });
});

describe('eventRepository.setFocusedAward', () => {
  /**
   * Round-tripped against a throwaway row, not one of the twelve restored
   * shows: this is the one test in this file that writes, and a ceremony
   * pointer left behind on the real Oscars row would put a category on every
   * watcher's screen.
   */
  async function withTemporaryEvent<T>(run: (id: number) => Promise<T>): Promise<T> {
    const now = new Date();
    const event = await db.event.create({
      data: {
        name: 'events-repo focus test',
        abbreviation: `events-repo-focus-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
    try {
      return await run(event.id);
    } finally {
      await db.event.delete({ where: { id: event.id } });
    }
  }

  it('is null until an admin puts something on screen', async () => {
    await withTemporaryEvent(async (id) => {
      expect((await eventRepository.findById(id)).focusedAwardId).toBeNull();
    });
  });

  it('round-trips a category id and clears it again', async () => {
    await withTemporaryEvent(async (id) => {
      await eventRepository.setFocusedAward(id, 4242);
      expect((await eventRepository.findById(id)).focusedAwardId).toBe(4242);

      // Null is the "nothing on screen" state, not an absence of a write —
      // taking a category off screen has to be readable by every watcher.
      await eventRepository.setFocusedAward(id, null);
      expect((await eventRepository.findById(id)).focusedAwardId).toBeNull();
    });
  });

  it('is carried by findByAbbreviation, which is what the show page reads', async () => {
    await withTemporaryEvent(async (id) => {
      const created = await db.event.findUniqueOrThrow({
        where: { id },
        select: { abbreviation: true },
      });
      await eventRepository.setFocusedAward(id, 99);

      const event = await eventRepository.findByAbbreviation(created.abbreviation);
      expect(event?.focusedAwardId).toBe(99);
    });
  });
});

describe('eventRepository.findAll', () => {
  it('returns every event', async () => {
    expect(await eventRepository.findAll()).toHaveLength(events.length);
  });

  it('orders by name, using the database collation', async () => {
    // Asserting against a JS sort would be wrong: the database collates
    // en_US.utf8, and JS localeCompare disagrees with it — "Screen Actors'
    // Guild" alone is enough to separate them, since the two treat the
    // apostrophe differently.
    const results = await eventRepository.findAll();

    const ordered = await db.$queryRaw<{ id: number }[]>`
      select id from events order by name asc
    `;

    expect(results.map((e) => e.id)).toEqual(ordered.map((r) => r.id));
  });

  it('reproduces the order the source API served', async () => {
    // Not a re-sort of the fixture — the captured order itself, which is what
    // the award-shows index rendered.
    const results = await eventRepository.findAll();

    expect(results.map((e) => e.abbreviation)).toEqual(events.map((e) => e.abbreviation));
  });
});

describe('eventRepository.findManyByIds', () => {
  it('returns the requested events', async () => {
    const results = await eventRepository.findManyByIds([1, 2, 3]);
    expect(results.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it('silently skips ids that do not resolve', async () => {
    const results = await eventRepository.findManyByIds([1, 999_999]);
    expect(results).toHaveLength(1);
  });

  it('accepts the bigint ids that awards store', async () => {
    // events.id is integer but awards.event_id is bigint, and there is no
    // foreign key holding the two together.
    expect(await eventRepository.findManyByIds([1n, 2n])).toHaveLength(2);
  });

  it('returns an empty array for an empty request', async () => {
    expect(await eventRepository.findManyByIds([])).toEqual([]);
  });
});

describe('eventRepository.findActive', () => {
  it('returns exactly the events the database considers live', async () => {
    // An array, not the single row the source app's getLiveEvent returned:
    // nothing in the schema stops two shows being live at once, and the
    // dashboard already filtered a list rather than trusting findOne.
    const results = await eventRepository.findActive();

    const expected = await db.$queryRaw<{ id: number }[]>`
      select id from events
      where nom_active is true or awards_active is true
      order by name asc
    `;

    expect(results.map((e) => e.id)).toEqual(expected.map((r) => r.id));
  });

  it('returns an empty array in the off season rather than null', async () => {
    // Most of the year no show is live. The dashboard renders a list, so the
    // empty case must be a list.
    const results = await eventRepository.findActive();
    expect(Array.isArray(results)).toBe(true);
  });
});
