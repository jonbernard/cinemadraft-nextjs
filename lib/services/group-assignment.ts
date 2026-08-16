/**
 * Dealing people into draft groups.
 *
 * A league drafts in groups — league 1's 2026 season is 4 groups of 4 seats —
 * and before a draft the owner assigns everyone. The randomiser exists because
 * doing it by hand for sixteen people is tedious and nobody wants to be seen
 * choosing.
 *
 * 🔴 **Dealt round-robin, not chunked.** Ported from the source's `makeGroups`
 * (`src/pages/league/orderAndGroups/utils.js`), which walks the groups in turn
 * taking a random person each time. That keeps the groups balanced by
 * construction: sixteen people into four groups gives 4/4/4/4, and seventeen
 * gives 5/4/4/4. Slicing a shuffled list into equal chunks looks equivalent
 * and is not — the remainder lands entirely on one group, so seventeen people
 * would give 5/4/4/4 only by luck of the rounding, and nineteen would give
 * 6/5/4/4 with a chunk size of five.
 */

export type Assignment = {
  draftId: number;
  /** 1-based; null means unassigned. */
  group: number | null;
  /** Position within the group, 1-based; null when unassigned. */
  order: number | null;
};

/**
 * Deal `draftIds` into `groupCount` groups, in the order given.
 *
 * Deterministic: the caller supplies the order, so a test can pass a known
 * sequence and the shuffle lives in `shuffle` below where it can be replaced.
 */
export function dealIntoGroups(
  draftIds: readonly number[],
  groupCount: number,
): Assignment[] {
  if (groupCount < 1)
    return draftIds.map((draftId) => ({ draftId, group: null, order: null }));

  const groups: number[][] = Array.from({ length: groupCount }, () => []);

  // Round-robin: person 0 to group 1, person 1 to group 2, and so on, wrapping.
  draftIds.forEach((draftId, index) => {
    groups[index % groupCount]?.push(draftId);
  });

  return groups.flatMap((members, groupIndex) =>
    members.map((draftId, position) => ({
      draftId,
      group: groupIndex + 1,
      order: position + 1,
    })),
  );
}

/**
 * A uniform shuffle (Fisher–Yates).
 *
 * The source picked a random index out of a shrinking array, which is the same
 * distribution done less clearly. This is separated from `dealIntoGroups` so
 * the dealing rule can be tested without randomness — the part that decides
 * fairness is the dealing, not the shuffle.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/**
 * How many groups a league of this size should have.
 *
 * The source made the owner choose, and every real league has landed on
 * groups of four — league 1's 2026 season is 4×4, and its earlier seasons the
 * same. This is only a *suggestion* for the control's default; the owner can
 * still pick any number.
 */
export function suggestGroupCount(memberCount: number): number {
  if (memberCount <= 4) return 1;
  return Math.ceil(memberCount / 4);
}
