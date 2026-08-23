import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const findAll = vi.hoisted(() => vi.fn());
vi.mock('@/lib/repositories/points', () => ({
  pointRepository: { findAll },
}));

import type { Point } from '@/lib/repositories/points';
import RulesAndScoringPage from './page';

function point(over: Partial<Point>): Point {
  return {
    id: 1,
    level: 'Level',
    tier: 1,
    points: 0,
    createdAt: null,
    updatedAt: null,
    ...over,
  } as Point;
}

/**
 * 🔴 Chosen to reproduce trap 1: a tier table full of numbers makes
 * `getByText('5')` genuinely ambiguous — Alphabet is flat at 5 across all
 * three tiers, so "5" appears three times. Every assertion below is scoped to
 * a row, never a bare `getByText` on a number.
 */
const points: Point[] = [
  point({ id: 1, level: 'Oscars', tier: 1, points: 20 }),
  point({ id: 2, level: 'Oscars', tier: 2, points: 15 }),
  point({ id: 3, level: 'Oscars', tier: 3, points: 10 }),
  point({ id: 4, level: 'Alphabet', tier: 1, points: 5 }),
  point({ id: 5, level: 'Alphabet', tier: 2, points: 5 }),
  point({ id: 6, level: 'Alphabet', tier: 3, points: 5 }),
];

describe('RulesAndScoringPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders the rulebook table with each level as its own row, ordered by value', async () => {
    findAll.mockResolvedValue(points);

    render(await RulesAndScoringPage());

    const rows = screen.getAllByRole('row');
    // Header row plus one row per level.
    expect(rows).toHaveLength(3);

    const oscarsRow = screen.getByRole('row', { name: /Oscars/ });
    const cells = within(oscarsRow).getAllByRole('cell');
    expect(cells.map((c) => c.textContent)).toEqual(['20', '15', '10']);

    const alphabetRow = screen.getByRole('row', { name: /Alphabet/ });
    const alphabetCells = within(alphabetRow).getAllByRole('cell');
    expect(alphabetCells.map((c) => c.textContent)).toEqual(['5', '5', '5']);
  });

  it('states the win rule in prose, matching lib/services/scoring.ts (a win is 2P)', async () => {
    findAll.mockResolvedValue(points);

    render(await RulesAndScoringPage());

    expect(screen.getByText(/A win earns it a second time/)).toBeInTheDocument();
  });
});
