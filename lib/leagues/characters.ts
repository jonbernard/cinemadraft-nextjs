/**
 * Placeholder seats, from the old app (P14.T18).
 *
 * A league drafts in equal groups, so an odd number of players leaves a group
 * short. The owner fills the gap with fictional characters — a seat somebody
 * drafts on behalf of — and this is the pool the "Add a character" button
 * draws from.
 *
 * 🔴 **These are the placeholders. The text field beside the button is not.**
 * Both create a seat with `dummy: true` and a `dummy_name`, because the
 * database has one mechanism for "a seat with no account behind it". But a name
 * typed into that field is a *real person* who has not registered yet, and
 * calling their seat a placeholder in the UI was the owner's complaint.
 * Membership of this list is what tells the two apart — see `isCharacter`.
 *
 * 🔴 **Why membership and not a `drafts.is_character` column.** A column would
 * be truer, but it is another migration, and Phase 13's final restore drops
 * every column this port has added — so it buys correctness at the price of one
 * more thing to re-apply during the cutover. The list is fixed and known, and
 * the failure mode of the cheap version is narrow and stated: a member
 * genuinely named "Neo" has their seat labelled a character. If the owner would
 * rather have the column, it is `drafts.is_character`, a sibling of P14.T12's
 * migration, and `isCharacter` is the one call site to change.
 *
 * Carried over verbatim, in the owner's order. Not sorted, not deduped, not
 * extended.
 */
export const CHARACTERS = [
  'Tyler Durden',
  'Indiana Jones',
  'Ellen Ripley',
  'Travis Bickle',
  'James Bond',
  'Vito Corleone',
  'Sweeney Todd',
  'Bill Cutting',
  'Forrest Gump',
  'Hannibal Lecter',
  'Roger Kint',
  'Anton Chigurh',
  'Daniel Plainview',
  'Tommy DeVito',
  'Ellis Boyd Redding',
  'John McClane',
  'Harry Callahan',
  'Jules Winnfield',
  'Ferris Bueller',
  'Tony Montana',
  'Marty McFly',
  'Rocky Balboa',
  'Charles Foster Kane',
  'Jason Bourne',
  'Sarah Connor',
  'Maggie Fitzgerald',
  'Jack Sparrow',
  'John Coffey',
  'Agent Smith',
  'Lloyd Christmas',
  'Bruce Wayne',
  'Max Cady',
  'Bobby Wiley',
  'Frank Slade',
  'Jake LaMotta',
  'Sonny Wortzik',
  'Andy Dufresne',
  'Han Solo',
  'Neo',
  'Norman Bates',
  'Michael Corleone',
  'Alonzo Harris',
  'Edward Scissorhands',
  'Hans Landa',
  'E.T.',
  'Frank Abagnale Jr.',
  'Viktor Navorski',
  'Penny Lane',
  'Annie Hall',
] as const;

/** Is this seat one of ours, or a real person who has not registered? */
export function isCharacter(name: string): boolean {
  return (CHARACTERS as readonly string[]).includes(name);
}

/**
 * A character not already seated in this league, or null when the pool is
 * exhausted.
 *
 * 🔴 Takes the names already present rather than reading them itself: a league
 * with Tyler Durden in it twice is two seats nobody can tell apart on a draft
 * board, and the owner drafts on behalf of both.
 *
 * 🔴 Takes `pick` so the test can be deterministic without stubbing a global.
 * `lib/services/group-assignment.ts` already owns `shuffle`; this is the same
 * posture — randomness is an argument, not an ambient fact.
 */
export function nextCharacter(
  taken: readonly string[],
  pick: (max: number) => number = (max) => Math.floor(Math.random() * max),
): string | null {
  const free = CHARACTERS.filter((name) => !taken.includes(name));
  return free.length === 0 ? null : (free[pick(free.length)] ?? null);
}
