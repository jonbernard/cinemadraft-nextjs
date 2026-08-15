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

/**
 * 🔴 TMDB is required, not optional.
 *
 * `movies` is a **cache** of TMDB — a film enters it the first time somebody
 * drafts or nominates it — so without a key the app can only find films the
 * league has already used, and no new release can be drafted or nominated at
 * all. That is a broken install, not a reduced feature set.
 *
 * It is not `required()` at import time, though, and the difference matters:
 * the missing webhook secret is a *security* failure, so it fails loudly at
 * the first call. A missing TMDB key degrades a feature. Crashing every page
 * that happens to import a search module — including the pages that render
 * fine from cached data — would turn a misconfiguration into an outage.
 *
 * So `lib/external/tmdb.ts` returns nothing when this is absent, the local
 * cache still answers, and attempting to use a film that is not cached refuses
 * with a message rather than a stack trace.
 */
export const tmdbEnv = {
  get apiKey(): string | null {
    return process.env.TMDB_API_KEY ?? null;
  },
  get isConfigured(): boolean {
    return Boolean(process.env.TMDB_API_KEY);
  },
};
