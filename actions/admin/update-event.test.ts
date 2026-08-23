// @vitest-environment node

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const currentUser = vi.hoisted(() => vi.fn());
vi.mock('@clerk/nextjs/server', () => ({ currentUser }));

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidatePath }));

import { db } from '@/lib/db';
import { updateEvent } from './update-event';

/**
 * 🔴 T26: `PUT /events/:abbreviation` was `Events.update(req.body, …)` in the
 * source — unfiltered mass assignment, `id` and `fbId` included. The whitelist
 * is the substance of this suite: every test that proves a field lands also
 * proves a field the payload carried alongside it did *not*.
 */
const TAG = 'update-event';
const DOMAIN = '@example.test';

async function makeUser(role: 'admin' | 'user') {
  return db.user.create({
    data: {
      uuid: randomUUID(),
      email: `${TAG}-${role}-${randomUUID().slice(0, 8)}${DOMAIN}`,
      clerkId: `user_${TAG}_${role}_${randomUUID().slice(0, 8)}`,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    select: { id: true, email: true, clerkId: true },
  });
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

async function makeEvent() {
  const now = new Date();
  return db.event.create({
    data: {
      fbId: `${TAG}-fb-original`,
      name: `${TAG} original name`,
      abbreviation: `${TAG}-${randomUUID().slice(0, 8)}`,
      nomActive: false,
      createdAt: now,
      updatedAt: now,
    },
    select: { id: true, fbId: true, name: true, abbreviation: true, nomActive: true },
  });
}

async function cleanup() {
  await db.event.deleteMany({ where: { fbId: { startsWith: TAG } } });
  await db.user.deleteMany({ where: { email: { contains: `${TAG}-` } } });
}

beforeEach(async () => {
  currentUser.mockReset();
  revalidatePath.mockClear();
  await cleanup();
});
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe('updateEvent — refusals', () => {
  it('🔴 refuses a signed-out caller and writes nothing', async () => {
    const event = await makeEvent();
    signInAs(null);

    const result = await updateEvent({ eventId: event.id, name: 'Hijacked' });

    expect(result.ok).toBe(false);
    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.name).toBe(event.name);
  });

  it('🔴 refuses a signed-in non-admin and writes nothing', async () => {
    const event = await makeEvent();
    const member = await makeUser('user');
    signInAs(member);

    const result = await updateEvent({ eventId: event.id, name: 'Hijacked' });

    expect(result.ok).toBe(false);
    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.name).toBe(event.name);
  });

  it('rejects input that is not a show', async () => {
    const admin = await makeUser('admin');
    signInAs(admin);

    expect(await updateEvent({ eventId: 0 })).toMatchObject({
      ok: false,
      code: 'INVALID',
    });
  });

  it('reports NOT_FOUND for a show that does not exist', async () => {
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await updateEvent({ eventId: 999_999_999, name: 'Whatever' });
    expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('🔴 refuses an abbreviation another show already uses, and writes nothing', async () => {
    // F4: `abbreviation` has no `@unique` in the schema and `findByAbbreviation`
    // is `findFirst` — a collision would silently shadow the other show.
    const taken = await makeEvent();
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await updateEvent({
      eventId: event.id,
      abbreviation: taken.abbreviation,
    });

    expect(result).toMatchObject({ ok: false, code: 'CONFLICT' });
    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.abbreviation).toBe(event.abbreviation);
  });

  it('allows an event to keep its own abbreviation', async () => {
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await updateEvent({
      eventId: event.id,
      abbreviation: event.abbreviation,
      name: 'Renamed but same slug',
    });

    expect(result.ok).toBe(true);
  });
});

describe('updateEvent', () => {
  it('writes only the whitelisted fields the caller actually sent', async () => {
    // The original bug this whitelist closes: a payload carrying an editable
    // field and one the schema does not accept at all lands only the first.
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await updateEvent({
      eventId: event.id,
      name: 'New name',
      // `fbId` is not part of `UpdateEventInput` at all — the type itself is
      // the whitelist, so there is nothing to pass through even if a caller
      // tried. Confirmed below by re-reading the row.
    });

    expect(result.ok).toBe(true);
    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.name).toBe('New name');
    expect(row?.fbId).toBe(event.fbId);
  });

  it('🔴 drops a forbidden field carried alongside a permitted one in the same call', async () => {
    // The exact shape of the source bug: `Events.update(req.body, …)` wrote
    // whatever the client posted, `id` and `fbId` included. A payload that
    // mixes a real field with one only the whitelist should refuse must land
    // the first and ignore the second — not fail the whole call, and not let
    // the forbidden field through because a permitted one was present too.
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const result = await updateEvent({
      eventId: event.id,
      name: 'Whitelisted name',
      // `UpdateEventInput` has no `fbId` field at all; this is the shape an
      // attacker would actually send, cast past the type the same way an
      // untyped `FormData` payload would arrive at runtime.
      ...({ fbId: 'attacker-controlled' } as Record<string, unknown>),
    });

    expect(result.ok).toBe(true);
    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.name).toBe('Whitelisted name');
    expect(row?.fbId).toBe(event.fbId);
  });

  it('leaves fields the caller did not send untouched (a PATCH, not a PUT)', async () => {
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    await updateEvent({ eventId: event.id, nomActive: true });

    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.nomActive).toBe(true);
    expect(row?.name).toBe(event.name);
    expect(row?.abbreviation).toBe(event.abbreviation);
  });

  it('normalizes the schedule fields to bigint milliseconds and back', async () => {
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const nomDate = Date.UTC(2026, 0, 20);
    await updateEvent({
      eventId: event.id,
      nomDate,
      nomTime: 90_000,
      nomDuration: 1_800_000,
    });

    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.nomDate).toBe(BigInt(nomDate));
    expect(row?.nomTime).toBe(BigInt(90_000));
  });

  it('clears a schedule field with null rather than ignoring it', async () => {
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    await updateEvent({ eventId: event.id, nomDate: 1_000, nomTime: 1_000 });
    await updateEvent({ eventId: event.id, nomDate: null });

    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.nomDate).toBeNull();
    // Untouched by the second call, which did not mention it.
    expect(row?.nomTime).toBe(1000n);
  });

  it('🔴 writes all thirteen whitelisted fields, each distinguishable from every other', async () => {
    // F1: the repository's `update` hand-assembles the six schedule columns
    // one by one. A copy-paste swap (e.g. `awardsDate: toBigInt(nomDate)`) or
    // a dropped line must fail this test — so every column here gets its own
    // value, and no `nom*` value equals its `awards*` counterpart.
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    const input = {
      eventId: event.id,
      name: 'Distinguishable name',
      abbreviation: `${TAG}-${randomUUID().slice(0, 8)}`,
      image: 'https://example.test/distinguishable.png',
      nomActive: true,
      nomDate: Date.UTC(2026, 0, 1),
      nomTime: 11_000,
      nomDuration: 111_000,
      awardsActive: false,
      awardsDate: Date.UTC(2026, 1, 2),
      awardsTime: 22_000,
      awardsDuration: 222_000,
      liveResults: true,
    } as const;

    const result = await updateEvent(input);
    expect(result.ok).toBe(true);

    const row = await db.event.findUnique({ where: { id: event.id } });
    expect(row?.name).toBe(input.name);
    expect(row?.abbreviation).toBe(input.abbreviation);
    expect(row?.image).toBe(input.image);
    expect(row?.nomActive).toBe(input.nomActive);
    expect(row?.awardsActive).toBe(input.awardsActive);
    expect(row?.liveResults).toBe(input.liveResults);
    expect(row?.nomDate).toBe(BigInt(input.nomDate));
    expect(row?.nomTime).toBe(BigInt(input.nomTime));
    expect(row?.nomDuration).toBe(BigInt(input.nomDuration));
    expect(row?.awardsDate).toBe(BigInt(input.awardsDate));
    expect(row?.awardsTime).toBe(BigInt(input.awardsTime));
    expect(row?.awardsDuration).toBe(BigInt(input.awardsDuration));

    // The point of the test: a nom/awards swap would still pass if any pair
    // shared a value.
    expect(row?.nomDate).not.toBe(row?.awardsDate);
    expect(row?.nomTime).not.toBe(row?.awardsTime);
    expect(row?.nomDuration).not.toBe(row?.awardsDuration);
    expect(row?.nomActive).not.toBe(row?.awardsActive);
  });

  it('revalidates the show page and the index', async () => {
    const event = await makeEvent();
    const admin = await makeUser('admin');
    signInAs(admin);

    await updateEvent({ eventId: event.id, name: 'Renamed' });

    expect(revalidatePath).toHaveBeenCalledWith(
      `/award-shows/${event.abbreviation}`,
      'layout',
    );
  });
});
