import { describe, expect, it } from 'vitest';

import { reorder } from './reorder';

const list = ['a', 'b', 'c', 'd'];

describe('reorder', () => {
  it('moves an item later', () => {
    expect(reorder(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item earlier', () => {
    expect(reorder(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves an item to the end', () => {
    expect(reorder(list, 0, 3)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('leaves the list alone when nothing moved', () => {
    expect(reorder(list, 2, 2)).toEqual(list);
  });

  it('🔴 leaves the list alone for a drop outside it', () => {
    // A cancelled drag reports no destination. Treating that as "move to the
    // end" would reorder a seat every time the owner thought better of it.
    expect(reorder(list, 1, -1)).toEqual(list);
    expect(reorder(list, 1, 9)).toEqual(list);
    expect(reorder(list, 9, 1)).toEqual(list);
  });

  it('never mutates the list it was given', () => {
    const original = [...list];
    reorder(list, 0, 3);
    expect(list).toEqual(original);
  });

  it('holds for a seat of thirty picks as readily as six (D34)', () => {
    const long = Array.from({ length: 30 }, (_, index) => index);
    expect(reorder(long, 29, 0)[0]).toBe(29);
  });
});
