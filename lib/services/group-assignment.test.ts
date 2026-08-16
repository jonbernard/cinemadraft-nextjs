import { describe, expect, it } from 'vitest';

import { dealIntoGroups, shuffle, suggestGroupCount } from './group-assignment';

/**
 * The rule that decides who drafts against whom.
 *
 * Pure and testable without a database, which matters because the property
 * that counts — balance — is invisible until the numbers do not divide.
 */
const sizes = (assignments: ReturnType<typeof dealIntoGroups>) => {
  const counts = new Map<number, number>();
  for (const entry of assignments) {
    if (entry.group == null) continue;
    counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([, size]) => size);
};

describe('dealIntoGroups', () => {
  it('deals sixteen people into four even groups', () => {
    // League 1's actual shape.
    const assignments = dealIntoGroups([...Array(16).keys()], 4);

    expect(sizes(assignments)).toEqual([4, 4, 4, 4]);
  });

  it('🔴 spreads the remainder rather than piling it on one group', () => {
    // The reason this is round-robin rather than chunked. Nineteen people
    // sliced into chunks of five gives 5/5/5/4; dealt, it gives 5/5/5/4 too —
    // but seventeen chunked gives 5/5/5/2, which is a group of two.
    expect(sizes(dealIntoGroups([...Array(17).keys()], 4))).toEqual([5, 4, 4, 4]);
    expect(sizes(dealIntoGroups([...Array(19).keys()], 4))).toEqual([5, 5, 5, 4]);
  });

  it('never differs by more than one between groups', () => {
    for (let people = 1; people <= 40; people += 1) {
      for (let groups = 1; groups <= 6; groups += 1) {
        const counts = sizes(dealIntoGroups([...Array(people).keys()], groups));
        if (counts.length === 0) continue;
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('numbers positions from one within each group', () => {
    const assignments = dealIntoGroups([10, 20, 30, 40], 2);

    const first = assignments.filter((entry) => entry.group === 1);
    expect(first.map((entry) => entry.order)).toEqual([1, 2]);
  });

  it('assigns every person exactly once', () => {
    const ids = [...Array(23).keys()];
    const assignments = dealIntoGroups(ids, 5);

    expect(assignments).toHaveLength(ids.length);
    expect(new Set(assignments.map((entry) => entry.draftId)).size).toBe(ids.length);
  });

  it('handles more groups than people without emptying anyone', () => {
    const assignments = dealIntoGroups([1, 2], 5);

    expect(assignments).toHaveLength(2);
    expect(sizes(assignments)).toEqual([1, 1]);
  });

  it('leaves everyone unassigned when asked for no groups', () => {
    const assignments = dealIntoGroups([1, 2, 3], 0);

    expect(assignments.every((entry) => entry.group === null)).toBe(true);
  });

  it('is deterministic — the caller owns the order', () => {
    // The shuffle is separate so the dealing rule can be tested exactly.
    expect(dealIntoGroups([1, 2, 3, 4], 2)).toEqual(dealIntoGroups([1, 2, 3, 4], 2));
  });
});

describe('shuffle', () => {
  it('keeps every item', () => {
    const items = [...Array(20).keys()];

    expect(shuffle(items).sort((a, b) => a - b)).toEqual(items);
  });

  it('does not mutate its input', () => {
    const items = [1, 2, 3];
    shuffle(items);

    expect(items).toEqual([1, 2, 3]);
  });

  it('🔴 can put any item in any position', () => {
    // The property a broken Fisher–Yates loses. Written as a distribution
    // check rather than by forcing a single draw: the first attempt mocked
    // `Math.random` to its maximum and asserted the result changed, which
    // fails against *correct* code — at the maximum draw `j === i` and every
    // swap is a self-swap, so the identity is the right answer. Asserting what
    // the algorithm guarantees needs more than one sample.
    const seen = new Map<number, Set<number>>([
      [0, new Set()],
      [1, new Set()],
      [2, new Set()],
    ]);

    for (let run = 0; run < 300; run += 1) {
      shuffle([1, 2, 3]).forEach((value, position) => {
        seen.get(position)?.add(value);
      });
    }

    for (const values of seen.values()) {
      expect(values).toEqual(new Set([1, 2, 3]));
    }
  });
});

describe('suggestGroupCount', () => {
  it('suggests groups of four, as every real league has used', () => {
    expect(suggestGroupCount(16)).toBe(4);
    expect(suggestGroupCount(12)).toBe(3);
  });

  it('keeps a small league in one group', () => {
    expect(suggestGroupCount(3)).toBe(1);
    expect(suggestGroupCount(4)).toBe(1);
  });

  it('rounds up rather than leaving anyone out', () => {
    expect(suggestGroupCount(17)).toBe(5);
  });
});
