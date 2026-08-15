'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ConflictError } from '@/lib/errors';
import { nominationRepository } from '@/lib/repositories/nominations';
import { winnerRepository } from '@/lib/repositories/winners';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeAward } from './guard';

const Input = z.object({
  awardId: z.int().positive(),
  year: z.int().positive(),
  /** Null clears the winner — the announcement was misheard. */
  movieId: z.int().positive().nullable(),
});

export type SetWinnerInput = z.infer<typeof Input>;

/**
 * Declare — or correct — the winner of a category (§12).
 *
 * 🔴 **Correcting is the same action as setting, on purpose.** Winners are
 * entered live from a stage announcement, so getting one wrong and fixing it
 * thirty seconds later is *ordinary*, not an error path (§12). A separate
 * "correct" action would be a second code path for the common case, and the
 * two would drift.
 *
 * Underneath, the repository replaces rather than inserts: one category has
 * one winner. Two rows would mean two winning films, and since a win pays the
 * award's points a second time (D41), it would pay them twice.
 *
 * 🔴 Admin-only. The source app's `POST /winners` had no auth at all, which
 * means anyone on the internet could have decided who won Best Picture and
 * moved every league's standings.
 *
 * **There is no recompute to trigger.** `PLAN.md` says this fires the phase 9
 * recompute; nothing is materialized yet, so totals are computed on read (D41)
 * and a correction is consistent by construction. The test that proves points
 * actually move is written anyway — phase 9 inherits it as a constraint it
 * must not break.
 */
export async function setWinner(input: SetWinnerInput): Promise<ActionResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that winner is not valid');

  try {
    const { award, abbreviation } = await authorizeAward(parsed.data.awardId);

    if (parsed.data.movieId == null) {
      await winnerRepository.clearForAward(award.id, parsed.data.year);
      revalidatePath(`/award-shows/${abbreviation}`, 'layout');
      return ok();
    }

    // 🔴 The winner has to be one of this category's nominees. A win pays the
    // award's points on top of the nomination's, so a winner that was never
    // nominated scores for a nomination that does not exist — the film would
    // hold points no page could explain.
    const nomination = await nominationRepository.findByAwardMovieYear(
      award.id,
      parsed.data.movieId,
      String(parsed.data.year),
    );
    if (!nomination) {
      throw new ConflictError(`that film is not nominated for ${award.name}`);
    }

    await winnerRepository.setForAward({
      awardId: award.id,
      year: parsed.data.year,
      movieId: parsed.data.movieId,
      nominationId: nomination.id,
    });

    revalidatePath(`/award-shows/${abbreviation}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
