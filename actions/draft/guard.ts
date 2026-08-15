import { getCurrentUser } from '@/lib/auth';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { type DraftPick, draftPickRepository } from '@/lib/repositories/draft-picks';
import { type Draft, draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { canManageLeague } from '@/lib/services/league-access';

/**
 * 🔴 The one gate in front of every draft write.
 *
 * Not a `'use server'` module: nothing here is callable from a browser. It is
 * the shared first act of the three actions, so that "may this person change
 * this draft" is answered in exactly one place and cannot be answered
 * differently by one of them.
 *
 * Three properties matter and each is deliberate:
 *
 * 1. **The league is derived, never accepted.** The source route read
 *    `req.body.leagueId` and authorized against that league — while writing to
 *    whatever `req.body.draftId` named. Those are two different facts from the
 *    same untrusted body, and nothing checked they agreed: send your own
 *    league's id with someone else's seat and the check passes on a league you
 *    own while the write lands on a league you do not. Here the league comes
 *    from the seat, so there is one fact and it cannot disagree with itself.
 *
 * 2. **Signed out is refused like anyone else**, with the same error. League
 *    pages are public (D44), so an anonymous caller reaching a write action is
 *    normal traffic rather than an anomaly; `canManageLeague` already answers
 *    false for a null user, and this keeps that the whole story.
 *
 * 3. **Membership of a seat is irrelevant.** Only owners enter picks (D46) —
 *    a member drafting into their own seat is still refused, because the draft
 *    runs on a call with the owner at the keyboard.
 */
export type SeatControl = {
  /** The acting owner. */
  userId: number;
  leagueId: number;
  seat: Draft;
};

async function authorize(seat: Draft): Promise<SeatControl> {
  if (seat.leagueId == null) {
    // A seat with no league is unreachable through the UI and cannot be
    // authorized against anything. Refusing beats guessing.
    throw new NotFoundError('league for draft', seat.id);
  }

  const [user, league] = await Promise.all([
    getCurrentUser(),
    leagueRepository.findById(seat.leagueId),
  ]);

  // The null check is written out rather than left to `canManageLeague` — it
  // answers false for a null user either way, but stating it here is what
  // narrows the type, so the returned `userId` is a number without a cast.
  if (!user || !canManageLeague(league, user.id)) {
    throw new ForbiddenError('only a league owner may change this draft');
  }

  return { userId: user.id, leagueId: league.id, seat };
}

/** Authorize a write against a seat the caller named directly. */
export async function authorizeSeat(draftId: number): Promise<SeatControl> {
  return authorize(await draftRepository.findById(draftId));
}

/**
 * Authorize a write against the seat an existing pick belongs to.
 *
 * Removal and reordering name a pick, not a seat, and the seat must come from
 * the stored row rather than from the caller — otherwise the ownership check
 * and the write again describe two different things.
 */
export async function authorizePick(
  pickId: number,
): Promise<SeatControl & { pick: DraftPick }> {
  const pick = await draftPickRepository.findById(pickId);
  return { ...(await authorizeSeat(pick.draftId)), pick };
}
