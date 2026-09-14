import { describe, expect, it } from 'vitest';

import { CHARACTERS, isCharacter, nextCharacter } from './characters';

/**
 * The pool the "Add a character" button draws from (P14.T18).
 *
 * The two properties that matter are the ones a careless edit breaks: the list
 * is the owner's, verbatim and in their order, and the same character is never
 * seated twice.
 */
describe('CHARACTERS', () => {
  it('carries all 49 names, in the owner’s order', () => {
    expect(CHARACTERS).toHaveLength(49);
    expect(CHARACTERS[0]).toBe('Tyler Durden');
    expect(CHARACTERS.at(-1)).toBe('Annie Hall');
  });

  it('holds no duplicates, so a name can only be taken once', () => {
    expect(new Set(CHARACTERS).size).toBe(CHARACTERS.length);
  });
});

describe('nextCharacter', () => {
  it('never offers a character already seated', () => {
    const taken = CHARACTERS.slice(0, 48);
    expect(nextCharacter(taken, () => 0)).toBe('Annie Hall');
  });

  it('returns null rather than repeating when the pool is exhausted', () => {
    // 🔴 49 characters is a hard ceiling. A league big enough to exhaust it
    // must get a refusal the UI can say out loud, not a duplicate seat.
    expect(nextCharacter([...CHARACTERS], () => 0)).toBeNull();
  });

  it('ignores names that are not characters at all', () => {
    // A league full of real people has the whole pool available.
    expect(nextCharacter(['Ada', 'Grace'], () => 0)).toBe('Tyler Durden');
  });
});

describe('isCharacter', () => {
  it('tells a character apart from a real person who has not registered', () => {
    expect(isCharacter('Neo')).toBe(true);
    expect(isCharacter('Jon Bernard')).toBe(false);
  });
});
