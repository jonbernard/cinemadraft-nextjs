/**
 * 🔴 Who may manage a league (D47).
 *
 * The source app authorizes every pick, reorder and deletion with
 * `league.owner.includes(req.user.id)` — and `leagues.owner` is a TEXT column
 * holding a JSON array, so league 1's value is the literal string `[3]`. That
 * makes the check a substring match rather than a membership test, and it is
 * wrong in both directions:
 *
 *   "[31]".includes(3)  → true   a stranger passes the check on someone
 *                                else's league and can rewrite their draft
 *   "[13]".includes(3)  → false  the actual owner is locked out
 *
 * The repository parses that column into `ownerIds: number[]` and fails closed
 * on unparseable text, so this compares numbers. It exists as its own function
 * — rather than inline in each action — so that there is exactly one answer to
 * "may this person change this league", and it can be tested directly.
 */
export function canManageLeague(
  league: { ownerIds: readonly number[] },
  userId: number | null | undefined,
): boolean {
  // A signed-out visitor manages nothing. League pages are public (D44), so
  // this is a normal call, not an error.
  if (userId == null) return false;
  return league.ownerIds.includes(userId);
}
