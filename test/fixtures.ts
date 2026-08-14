import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE_DIR = join(process.cwd(), 'fixtures');

/**
 * Load a captured API response.
 *
 * These are the golden responses from the live Heroku API, scrubbed of
 * personal data (`scripts/scrub-fixtures.mjs`). They are the contract every
 * ported repository is tested against, and they cannot be recaptured once
 * Heroku is retired.
 *
 * Where a repository's output disagrees with a fixture, the fixture wins —
 * unless it encodes one of the source-app bugs recorded in `docs/PROGRESS.md`,
 * in which case the correct behaviour wins and the test documents why.
 */
export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8')) as T;
}
