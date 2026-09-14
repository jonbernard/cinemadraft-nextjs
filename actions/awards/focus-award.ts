'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { eventRepository } from '@/lib/repositories/events';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeAward } from './guard';

const Input = z.object({
  awardId: z.int().positive(),
  /** False takes it off screen. */
  on: z.boolean(),
});

export type FocusAwardInput = z.infer<typeof Input>;

/**
 * Put one category on every watcher's screen, or take it off (P10.T32).
 *
 * 🔴 Admin-only, through the same `authorizeAward` gate as the winner writes —
 * and the show is derived from the award rather than accepted from the caller,
 * so two facts from one untrusted payload cannot disagree.
 *
 * This changes no scoring input. It is the ceremony's pointer: the admin says
 * "this is the one being announced" and every open `/live` frame carries it
 * within one poll (D102). `revalidatePath` is for the admin's own page, so the
 * control they just pressed reflects what they pressed; the watchers do not
 * need it, because the stream re-reads.
 */
export async function focusAward(input: FocusAwardInput): Promise<ActionResult> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that category is not valid');

  try {
    const { award, abbreviation } = await authorizeAward(parsed.data.awardId);
    await eventRepository.setFocusedAward(
      award.eventId,
      parsed.data.on ? award.id : null,
    );
    revalidatePath(`/award-shows/${abbreviation}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
