import { draftRepository } from '@/lib/repositories/drafts';
import { type League, leagueRepository } from '@/lib/repositories/leagues';
import { canManageLeague } from './league-access';

export type MyLeague = {
  id: number;
  name: string;
  status: League['draftingStatus'];
  /** The invite link's uuid; only an owner is shown it. */
  uuid: string | null;
  isOwner: boolean;
  /** Seasons this league has drafted, newest first. */
  years: number[];
  memberCount: number;
};

/**
 * The leagues someone belongs to.
 *
 * Membership is a seat: there is no members table, so "my leagues" is the
 * distinct set of `drafts.league_id` for that user. Batched throughout — one
 * query for the ids, one for the leagues, one for the seats — rather than a
 * lookup per league, for the same reason every score read is batched (D59).
 */
export async function getMyLeagues(userId: number): Promise<MyLeague[]> {
  const leagueIds = await draftRepository.findLeagueIdsByUserId(userId);
  if (leagueIds.length === 0) return [];

  const leagues = await leagueRepository.findManyByIds(leagueIds);

  // Every seat in those leagues, in one query, to derive both the seasons and
  // the member count without asking per league.
  const seats = (
    await Promise.all(leagues.map((league) => draftRepository.findByLeagueId(league.id)))
  ).flat();

  return leagues
    .map((league) => {
      const own = seats.filter((seat) => seat.leagueId === league.id);
      const years = [
        ...new Set(own.flatMap((seat) => (seat.year == null ? [] : [seat.year]))),
      ].sort((a, b) => b - a);
      const isOwner = canManageLeague(league, userId);

      return {
        id: league.id,
        name: league.name,
        status: league.draftingStatus,
        // 🔴 Only an owner sees the invite. It is the join credential — anyone
        // holding it can seat themselves — so showing it to every member would
        // make every member able to re-share the league.
        uuid: isOwner ? league.uuid : null,
        isOwner,
        years,
        memberCount: new Set(
          own.flatMap((seat) => (seat.userId == null ? [] : [seat.userId])),
        ).size,
      };
    })
    .sort(
      (a, b) => (b.years[0] ?? 0) - (a.years[0] ?? 0) || a.name.localeCompare(b.name),
    );
}
