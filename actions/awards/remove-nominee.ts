'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { nominationRepository } from '@/lib/repositories/nominations';
import { winnerRepository } from '@/lib/repositories/winners';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeAward } from './guard';

const Input = z.int().positive();

/**
 * Take a film back out of a category (§12).
 *
 * 🔴 Admin-only; the source app left this open to anyone with curl.
 *
 * If the film being removed was the recorded winner, its win goes with it.
 * Leaving the winner row behind would mean a category won by a film that is
 * not nominated in it — and since a win pays the award's points a *second*
 * time on top of the nomination (D41), the film would keep scoring for a
 * nomination the app no longer believes in.
 */
export async function removeNominee(nominationId: number): Promise<ActionResult> {
  const parsed = Input.safeParse(nominationId);
  if (!parsed.success) return fail('INVALID', 'that nomination is not valid');

  try {
    const nomination = await nominationRepository.findById(parsed.data);
    const { abbreviation } = await authorizeAward(nomination.awardId);

    const year = nomination.year;
    if (year != null) {
      const winners = await winnerRepository.findManyByAwardIds(
        [nomination.awardId],
        year,
      );
      if (winners.some((winner) => winner.movieId === nomination.movieId)) {
        await winnerRepository.clearForAward(nomination.awardId, year);
      }
    }

    await nominationRepository.deleteById(nomination.id);

    revalidatePath(`/award-shows/${abbreviation}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
