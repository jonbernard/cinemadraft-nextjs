// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { getWorkedExample } from './how-it-works';
import { getLeaderboard } from './leaderboard';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * The worked example against the restored corpus — the evidence that the page
 * shows sixty real people's season and not a fixture.
 *
 * Excluded from CI (`vitest.ci.config.mts`): CI has the schema and no rows, so
 * `getWorkedExample` correctly returns null there and every assertion below
 * would be vacuous. The season-walk and selection *rules* are pinned in
 * `how-it-works.test.ts`, which needs no database and runs on every push.
 */
describe('getWorkedExample, against real data', () => {
  it('agrees with the leaderboard, film for film and number for number', async () => {
    const example = await getWorkedExample();
    expect(example).not.toBeNull();
    if (!example) return;

    const board = await getLeaderboard(example.year);
    expect(board.rows[0]?.movieId).toBe(example.best.movieId);
    expect(board.rows[0]?.total).toBe(example.best.total);
    expect(board.rows[0]?.title).toBe(example.best.title);
  });

  it('adds the lines up to the total, exactly', async () => {
    const example = await getWorkedExample();
    expect(example).not.toBeNull();
    if (!example) return;

    const summed = example.best.lines.reduce((sum, line) => sum + line.earned, 0);
    expect(summed).toBe(example.best.total);
    // A one-line example teaches nothing; the restored seasons all have films
    // with several nominations, and an example that suddenly had one would be
    // a signal that the season walk landed somewhere unexpected.
    expect(example.best.lines.length).toBeGreaterThan(1);
  });

  it('earns exactly twice the nomination value on every winning line', async () => {
    const example = await getWorkedExample();
    expect(example).not.toBeNull();
    if (!example) return;

    for (const line of example.best.lines) {
      expect(line.earned).toBe(line.won ? line.points * 2 : line.points);
    }
  });

  it('carries a poster and a real title for the film it picked', async () => {
    const example = await getWorkedExample();
    expect(example).not.toBeNull();
    if (!example) return;

    expect(example.best.title).not.toBe('Untitled');
    expect(example.best.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\//);
  });

  // 🔴 Conditional by necessity, and worth saying so: in the restored corpus the
  // season's last row genuinely IS negative, so "only on a negative total" is
  // unfalsifiable *here* — relaxing the sign rule in the service leaves this
  // green. The rule is pinned where it can fail, in `how-it-works.test.ts`
  // ("names no casualty when the lowest-scoring film still scored something").
  // What this does catch is the casualty being some other film than the board's
  // last row, and its lines not adding up to its total.
  it('takes the casualty from the bottom of the same board, lines and all', async () => {
    const example = await getWorkedExample();
    expect(example).not.toBeNull();
    if (!example?.worst) return;

    const board = await getLeaderboard(example.year);
    expect(board.rows[board.rows.length - 1]?.movieId).toBe(example.worst.movieId);
    expect(example.worst.total).toBeLessThan(0);
    expect(example.worst.lines.reduce((sum, line) => sum + line.earned, 0)).toBe(
      example.worst.total,
    );
  });
});
