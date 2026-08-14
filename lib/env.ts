/**
 * Read auth secrets in one place, and fail loudly when one is missing.
 *
 * The webhook signing secret is the dangerous one. Without it the webhook
 * route cannot verify a signature, and the tempting fix under deadline is to
 * skip verification "just in Preview" — which turns the claim endpoint into an
 * unauthenticated way to attach any Clerk id to any email address, i.e. to
 * take over any account. Failing at startup makes the missing secret an
 * obvious deployment problem instead of a subtle security decision.
 *
 * These are getters rather than eager reads so that importing this module —
 * from a test, a build step, or a route that does not need auth — does not
 * itself require the secret to be present.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const clerkEnv = {
  get webhookSecret(): string {
    return required('CLERK_WEBHOOK_SIGNING_SECRET');
  },
};
