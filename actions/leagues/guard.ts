import { getCurrentUser } from '@/lib/auth';
import { ForbiddenError } from '@/lib/errors';
import { type League, leagueRepository } from '@/lib/repositories/leagues';
import { canManageLeague } from '@/lib/services/league-access';

/**
 * 🔴 The gate in front of every write that changes a league.
 *
 * Same shape as `actions/draft/guard.ts` and for the same reason: there is one
 * answer to "may this person change this league" (D47), and an action that
 * asked differently would be the one that got it wrong.
 *
 * Not a `'use server'` module — nothing here is callable from a browser.
 */
export type LeagueControl = { userId: number; league: League };

export async function authorizeLeague(leagueId: number): Promise<LeagueControl> {
  const [user, league] = await Promise.all([
    getCurrentUser(),
    leagueRepository.findById(leagueId),
  ]);

  if (!user || !canManageLeague(league, user.id)) {
    throw new ForbiddenError('only a league owner may change this league');
  }

  return { userId: user.id, league };
}
