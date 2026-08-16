'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { getActiveYear } from '@/lib/services/season';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.uuid();

/**
 * Join a league from its invite link (P10.T1).
 *
 * The uuid *is* the invite: it is on the league row, and holding it is the
 * authorisation. Nothing else gates joining, which matches the source and is
 * the whole point of a shareable link.
 *
 * 🔴 **Joining twice must not create a second seat.** Two seats means the
 * member appears twice on the board, drafts twice, and scores twice. The
 * source guards this by loading the caller's own seats and checking there are
 * none (`server/routes/draft.js:28`), and the check is deliberately **not**
 * year-scoped: membership is of the league, not of a season, so someone who
 * played in 2017 is already a member. Seats for later seasons come from the
 * owner staging the next draft, not from re-joining.
 *
 * An unknown uuid is a `NotFoundError`, which the page turns into a 404. A
 * mistyped or expired invite is a user mistake, not a failure.
 */
export async function joinLeague(
  uuid: string,
): Promise<ActionResult<{ leagueId: number; alreadyMember: boolean }>> {
  const parsed = Input.safeParse(uuid);
  if (!parsed.success) return fail('NOT_FOUND', 'that invite link is not valid');

  try {
    const user = await requireUser();

    const league = await leagueRepository.findByUuid(parsed.data);
    if (!league) throw new NotFoundError('league for invite', parsed.data);

    const existing = await draftRepository.findByLeagueIdAndUserId(league.id, user.id);
    if (existing) {
      // Not an error: following your own invite link twice, or a link someone
      // re-sent, should land you in the league rather than refuse.
      return ok({ leagueId: league.id, alreadyMember: true });
    }

    await draftRepository.create({
      leagueId: league.id,
      year: await getActiveYear(),
      userId: user.id,
    });

    revalidatePath('/leagues');
    revalidatePath(`/leagues/${league.id}`, 'layout');
    return ok({ leagueId: league.id, alreadyMember: false });
  } catch (error) {
    return toActionResult(error);
  }
}
