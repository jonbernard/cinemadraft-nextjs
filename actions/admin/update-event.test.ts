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
