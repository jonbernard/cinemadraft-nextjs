import { describe, expect, it } from 'vitest';

import { canManageLeague } from './league-access';

/**
 * 🔴 The bug this replaces is not a near-miss: it admits the wrong user and
 * rejects the right one. Both directions are pinned.
 */
describe('canManageLeague', () => {
  it('🔴 rejects a user whose id is a substring of the owner id', () => {
    // The source check was `"[31]".includes(3)`, which is true — user 3 could
    // add, reorder and delete picks in a league owned by user 31.
    expect(canManageLeague({ ownerIds: [31] }, 3)).toBe(false);
  });

  it('🔴 admits the real owner whose id is not a substring of the text', () => {
    // The mirror image: `"[13]".includes(3)` is false, so the actual owner of
    // league 13 was locked out of their own draft.
    expect(canManageLeague({ ownerIds: [13] }, 13)).toBe(true);
  });

  it('admits an owner listed alongside others', () => {
    expect(canManageLeague({ ownerIds: [3, 27, 30] }, 27)).toBe(true);
  });

  it('rejects a member who is not an owner', () => {
    expect(canManageLeague({ ownerIds: [3] }, 27)).toBe(false);
  });

  it('fails closed on an empty owner list', () => {
    // What the repository returns when the column is null or unparseable.
    // Nobody managing a league is recoverable; everybody managing it is not.
    expect(canManageLeague({ ownerIds: [] }, 3)).toBe(false);
  });

  it.each([null, undefined])('fails closed for a signed-out visitor (%s)', (userId) => {
    // League pages are public (D44), so this is the common path, not an error.
    expect(canManageLeague({ ownerIds: [3] }, userId)).toBe(false);
  });
});

describe('🔴 the production data this protects', () => {
  it('rejects the exact pairs the source check wrongly admits', () => {
    // Not hypothetical. Measured against the restored production data: 29
    // (league, stranger) pairs across 11 of the 13 leagues pass
    // `owner.includes(userId)` today. Two real examples:
    //
    //   league 3 "Movies!!"  owner "[30]"  admits user 3
    //   league 2 "Test"      owner "[27]"  admits user 7 and user 2
    //
    // Anyone admitted could add, reorder and delete picks in a league that is
    // not theirs, which in this app means rewriting somebody's whole season.
    expect(canManageLeague({ ownerIds: [30] }, 3)).toBe(false);
    expect(canManageLeague({ ownerIds: [27] }, 7)).toBe(false);
    expect(canManageLeague({ ownerIds: [27] }, 2)).toBe(false);

    // And still admits each of those leagues' real owners.
    expect(canManageLeague({ ownerIds: [30] }, 30)).toBe(true);
    expect(canManageLeague({ ownerIds: [27] }, 27)).toBe(true);
  });
});
