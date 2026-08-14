import { mergeConfig } from 'vitest/config';

import base from './vitest.config.mts';

/**
 * The subset of the suite that can honestly run on CI.
 *
 * CI gets a Postgres service and the Prisma migrations, so it has the real
 * *schema* — but not the data. The restored production database is 60 real
 * people's names, emails, leagues and drafts, and it is not going into a
 * GitHub runner. The contract tests read that data directly (`findById(1)` is
 * expected to be *Arrival*), so they cannot pass against an empty schema and
 * are excluded here rather than weakened into something that would pass
 * anywhere.
 *
 * What still runs on CI is everything that either needs no database at all
 * (tokens, contrast, the OKLCH clamp, components) or seeds its own rows — and
 * that second group includes every security test in the project: the claim
 * rules, session resolution, webhook signature verification and the admin
 * relink guard. Those are the ones a regression would hurt most, and they run
 * on every push.
 *
 * The excluded suites still run locally, and `npm run test` remains the full
 * suite. They are the pre-cutover gate (spec §13), not dead weight — see
 * `docs/PROGRESS.md` for how to restore the database.
 */
export default mergeConfig(base, {
  test: {
    exclude: [
      'node_modules',
      '.next',
      'e2e',
      // Contract tests against restored production data.
      'lib/repositories/**',
      'lib/schema.test.ts',
      'lib/services/clerk-identity.production.test.ts',
      // Asserts the local Docker connection string (port 5433) and the
      // restored row counts — it is a check on the developer's environment,
      // which is exactly what CI is not.
      'lib/db.test.ts',
    ],
  },
});
