'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { getActiveYear } from '@/lib/services/season';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({
  name: z.string().trim().min(1).max(120),
  /**
   * How the draft order runs. Measured reality is snake (D50), but the column
   * exists and the source's create form asks, so the choice is kept.
   */
  type: z.enum(['snake', 'linear']),
});

export type CreateLeagueInput = z.infer<typeof Input>;

/**
 * Start a league (P10.T11).
 *
 * 🔴 **The creator is seated in the same breath.** The source app does this
 * (`server/routes/league.js:35-46`) and it is not incidental: membership is
 * the existence of a `drafts` row, so a league whose owner has no seat renders
 * an empty board, does not appear in its own creator's league list, and cannot
 * be drafted in. Creating the league and not the seat is a half-created league.
 *
 * The season comes from `getActiveYear()` rather than an env var (D22) — the
 * source read `REACT_APP_ACTIVE_YEAR`, which made changing seasons a redeploy.
 */
export async function createLeague(
  input: CreateLeagueInput,
): Promise<ActionResult<{ leagueId: number }>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that league is not valid');

  try {
    const user = await requireUser();
    const year = await getActiveYear();

    const league = await leagueRepository.create({
      name: parsed.data.name,
      ownerId: user.id,
      type: parsed.data.type,
    });

    await draftRepository.create({
      leagueId: league.id,
      year,
      userId: user.id,
    });

    revalidatePath('/leagues');
    return ok({ leagueId: league.id });
  } catch (error) {
    return toActionResult(error);
  }
}
