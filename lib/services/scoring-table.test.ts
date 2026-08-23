import { describe, expect, it } from 'vitest';

import type { Point } from '@/lib/repositories/points';
import { groupPointsByLevel } from './scoring-table';

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
 * Three levels, three tiers each — mirrors the real table's shape (Alphabet /
 * Golden Globes / Oscars / Razzies, three tiers apiece) closely enough that a
 * grouping which collapsed everything into one bucket, or that ignored tier
 * order, would be caught. Deliberately unordered on input, so the function's
 * own sort is what is under test, not an already-sorted fixture.
 */
const rows: Point[] = [
  point({ id: 1, level: 'Alphabet', tier: 3, points: 5 }),
  point({ id: 2, level: 'Oscars', tier: 1, points: 20 }),
  point({ id: 3, level: 'Alphabet', tier: 1, points: 5 }),
  point({ id: 4, level: 'Razzies', tier: 1, points: -20 }),
  point({ id: 5, level: 'Oscars', tier: 3, points: 10 }),
  point({ id: 6, level: 'Alphabet', tier: 2, points: 5 }),
  point({ id: 7, level: 'Oscars', tier: 2, points: 15 }),
  point({ id: 8, level: 'Razzies', tier: 3, points: -10 }),
  point({ id: 9, level: 'Razzies', tier: 2, points: -15 }),
];

describe('groupPointsByLevel', () => {
  it('groups every row under its level (at least two levels, fixture adequacy)', () => {
    const grouped = groupPointsByLevel(rows);
    expect(grouped.map((g) => g.level).sort()).toEqual(['Alphabet', 'Oscars', 'Razzies']);
  });

  it('keeps every tier within a level (at least two tiers within one level)', () => {
    const grouped = groupPointsByLevel(rows);
    const oscars = grouped.find((g) => g.level === 'Oscars');
    expect(oscars?.tiers).toEqual([
      { tier: 1, points: 20 },
      { tier: 2, points: 15 },
      { tier: 3, points: 10 },
    ]);
  });

  it('orders tiers ascending within a level, regardless of input order', () => {
    const grouped = groupPointsByLevel(rows);
    const razzies = grouped.find((g) => g.level === 'Razzies');
    expect(razzies?.tiers.map((t) => t.tier)).toEqual([1, 2, 3]);
  });

  it('orders levels by descending point value, negatives included', () => {
    const grouped = groupPointsByLevel(rows);
    expect(grouped.map((g) => g.level)).toEqual(['Oscars', 'Alphabet', 'Razzies']);
  });

  it('does not collapse a flat level (every tier the same value) into one row', () => {
    // Alphabet is flat at 5 in the real data — a grouping bug that merged
    // identical-value tiers into a single entry would still show "Alphabet",
    // just with one tier instead of three.
    const grouped = groupPointsByLevel(rows);
    const alphabet = grouped.find((g) => g.level === 'Alphabet');
    expect(alphabet?.tiers).toHaveLength(3);
  });

  it('drops a row with no level or tier rather than guessing a bucket for it', () => {
    // Both are nullable columns in the schema; nothing enforces that every
    // row carries them.
    const withJunk = [
      ...rows,
      point({ id: 10, level: null, tier: 1, points: 99 }),
      point({ id: 11, level: 'Alphabet', tier: null, points: 99 }),
    ];
    const grouped = groupPointsByLevel(withJunk);
    const alphabet = grouped.find((g) => g.level === 'Alphabet');
    expect(alphabet?.tiers).toHaveLength(3);
    expect(grouped.flatMap((g) => g.tiers.map((t) => t.points))).not.toContain(99);
  });

  it('treats a null points value as zero rather than throwing or dropping the row', () => {
    const withNullPoints = [
      ...rows,
      point({ id: 12, level: 'Gotham', tier: 1, points: null }),
    ];
    const grouped = groupPointsByLevel(withNullPoints);
    const gotham = grouped.find((g) => g.level === 'Gotham');
    expect(gotham?.tiers).toEqual([{ tier: 1, points: 0 }]);
  });
});
