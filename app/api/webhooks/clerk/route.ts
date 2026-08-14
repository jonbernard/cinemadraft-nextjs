import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';

import { clerkEnv } from '@/lib/env';
import { syncClerkIdentity } from '@/lib/services/clerk-identity';

/**
 * Clerk tells us an identity was created or changed; we re-run the claim path.
 *
 * This is one of the few routes that exists at all under D8 — a webhook is
 * HTTP by definition, so it cannot be a Server Action.
 *
 * 🔴 `verifyWebhook` checks the svix signature against
 * CLERK_WEBHOOK_SIGNING_SECRET and throws if it does not match. That check is
 * the only thing standing between this endpoint and an attacker POSTing a
 * chosen email/id pair to claim any account in the database. It must never be
 * bypassed — not behind a "preview only" flag, not to debug a delivery. The
 * secret is read through `clerkEnv` so a missing one fails loudly here rather
 * than silently degrading into an unauthenticated endpoint.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request, { signingSecret: clerkEnv.webhookSecret });
  } catch {
    // Deliberately terse. A precise error tells a prober exactly which part of
    // the signature it got wrong, which is free help toward forging one.
    return new Response('invalid signature', { status: 400 });
  }

  if (event.type !== 'user.created' && event.type !== 'user.updated') {
    // 200, not 4xx: a non-2xx makes Clerk retry, and retrying an event we
    // deliberately ignore would repeat forever.
    return Response.json({ ignored: event.type });
  }

  const data = event.data;
  const result = await syncClerkIdentity({
    clerkId: data.id,
    emails: (data.email_addresses ?? []).map((email) => ({
      address: email.email_address,
      verified: email.verification?.status === 'verified',
    })),
    // Clerk's webhook payload is snake_case; the identity type this app passes
    // around is camelCase. Mapping here keeps the wire shape from leaking into
    // the service, which the session path also calls with camelCase.
    firstName: data.first_name ?? null,
    lastName: data.last_name ?? null,
    image: data.image_url ?? null,
  });

  // A collision is reported as handled. It is a real, final outcome that a
  // retry cannot improve, and it has already been logged for admin repair.
  return Response.json({ status: result.status });
}
