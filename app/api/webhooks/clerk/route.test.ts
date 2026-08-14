import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { POST } from './route';

/**
 * 🔴 The endpoint's only authentication is its svix signature.
 *
 * Unlike the other suites here, Clerk is NOT mocked. `verifyWebhook` runs for
 * real against a known signing secret, and the signatures below are computed
 * the way svix computes them. Mocking verification would leave the one control
 * that matters — that an unsigned body changes nothing — asserted against a
 * stub that always agrees.
 */
const SECRET = 'whsec_dGVzdHNlY3JldHRlc3RzZWNyZXR0ZXN0c2U=';
const DOMAIN = '@example.test';

/**
 * Svix signs `${id}.${timestamp}.${body}` with the base64 secret (after the
 * `whsec_` prefix) and sends it base64 as `v1,<sig>`.
 */
function sign(body: string, id: string, timestamp: number): string {
  const key = Buffer.from(SECRET.replace('whsec_', ''), 'base64');
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return `v1,${signature}`;
}

function request(
  payload: unknown,
  options: { signed?: boolean; skewSeconds?: number } = {},
) {
  const body = JSON.stringify(payload);
  const id = `msg_${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000) + (options.skewSeconds ?? 0);

  const headers = new Headers({ 'content-type': 'application/json' });
  if (options.signed !== false) {
    headers.set('svix-id', id);
    headers.set('svix-timestamp', String(timestamp));
    headers.set('svix-signature', sign(body, id, timestamp));
  }

  return new NextRequest('https://next.cinemadraft.com/api/webhooks/clerk', {
    method: 'POST',
    headers,
    body,
  });
}

function userCreated(over: Record<string, unknown> = {}) {
  return {
    type: 'user.created',
    data: {
      id: 'user_hooked',
      email_addresses: [
        { email_address: `hooked${DOMAIN}`, verification: { status: 'verified' } },
      ],
      first_name: 'Webhook',
      last_name: 'Tester',
      image_url: null,
      ...over,
    },
  };
}

async function cleanup() {
  await db.user.deleteMany({ where: { email: { contains: DOMAIN } } });
}

describe('clerk webhook', () => {
  beforeEach(async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = SECRET;
    await cleanup();
  });

  afterEach(cleanup);

  it('🔴 rejects an unsigned request and writes nothing', async () => {
    // The takeover attempt: POST a chosen email and clerk id, inherit the
    // account. The signature is what stops it.
    const before = await db.user.count();

    const response = await POST(request(userCreated(), { signed: false }));

    expect(response.status).toBe(400);
    expect(await db.user.count()).toBe(before);
  });

  it('🔴 rejects a request signed with the wrong secret', async () => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET =
      'whsec_bm90dGhlcmlnaHRzZWNyZXRhdGFsbGhlcmU=';
    const before = await db.user.count();

    const response = await POST(request(userCreated()));

    expect(response.status).toBe(400);
    expect(await db.user.count()).toBe(before);
  });

  it('🔴 rejects a tampered body whose signature no longer matches', async () => {
    // Replay a valid signature against different content — the attack the
    // timestamped signature exists to prevent.
    const original = request(userCreated());
    const tampered = new NextRequest(original.url, {
      method: 'POST',
      headers: original.headers,
      body: JSON.stringify(userCreated({ id: 'user_attacker' })),
    });

    expect((await POST(tampered)).status).toBe(400);
  });

  it('🔴 rejects a stale timestamp, so a captured request cannot be replayed', async () => {
    const response = await POST(request(userCreated(), { skewSeconds: -60 * 60 }));
    expect(response.status).toBe(400);
  });

  it('accepts a correctly signed event and creates the account', async () => {
    const response = await POST(request(userCreated()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'created' });
    const row = await db.user.findFirst({ where: { email: `hooked${DOMAIN}` } });
    expect(row?.clerkId).toBe('user_hooked');
  });

  it('claims a legacy account on a verified address', async () => {
    const legacy = await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `Hooked${DOMAIN}`,
        provider: 'auth0',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      select: { id: true },
    });

    const response = await POST(request(userCreated()));

    await expect(response.json()).resolves.toEqual({ status: 'claimed' });
    const row = await db.user.findUnique({ where: { id: legacy.id } });
    expect(row?.clerkId).toBe('user_hooked');
  });

  it('🔴 does not claim on an unverified address, even when correctly signed', async () => {
    // A valid signature proves the message came from Clerk. It says nothing
    // about whether the address belongs to the sender.
    await db.user.create({
      data: {
        uuid: randomUUID(),
        email: `hooked${DOMAIN}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await POST(
      request(
        userCreated({
          email_addresses: [
            { email_address: `hooked${DOMAIN}`, verification: { status: 'unverified' } },
          ],
        }),
      ),
    );

    await expect(response.json()).resolves.toEqual({ status: 'unverified' });
    const row = await db.user.findFirst({ where: { email: `hooked${DOMAIN}` } });
    expect(row?.clerkId).toBeNull();
  });

  it('handles user.updated, which is when verification usually completes', async () => {
    const response = await POST(request({ ...userCreated(), type: 'user.updated' }));
    await expect(response.json()).resolves.toEqual({ status: 'created' });
  });

  it('ignores an unhandled event type with 200, so Clerk stops retrying', async () => {
    const response = await POST(
      request({ type: 'session.created', data: { id: 'sess_1' } }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ignored: 'session.created' });
  });

  it('tolerates an event with no email addresses at all', async () => {
    const response = await POST(request(userCreated({ email_addresses: undefined })));
    await expect(response.json()).resolves.toEqual({ status: 'unverified' });
  });
});
