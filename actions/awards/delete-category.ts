'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { ConflictError } from '@/lib/errors';
import { awardRepository } from '@/lib/repositories/awards';
import { nominationRepository } from '@/lib/repositories/nominations';
import { winnerRepository } from '@/lib/repositories/winners';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeAward } from './guard';

const Input = z.int().positive();

/**
 * Remove a category (T27).
 *
 * 🔴 **Refuses rather than cascades.** `Nomination.awardId` is an unenforced
 * reference — the source `DELETE /awards/:id` scoped on id alone and left any
 * nominations pointing at nothing. They do not disappear from the app:
 * `scoring.ts`'s `pointsByAward` lookup misses on a dangling award id and
 * silently scores them zero, which rewrites a season's totals with no record
 * that anything changed. This mirrors the ruling already made for seats and
 * picks — an admin who genuinely wants the nominations gone deletes them
 * first, deliberately, rather than having a delete decide it for them.
 *
 * The orphan check also counts `winners` alongside `nominations`: a winner
 * carries its own unenforced `awardId` and pays the category's points a
 * second time (D41), so an orphaned winner row is the same class of silent
 * score rewrite as an orphaned nomination.
 */
export async function deleteCategory(awardId: number): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = Input.safeParse(awardId);
    if (!parsed.success) return fail('INVALID', 'that category is not valid');

    const { award, abbreviation } = await authorizeAward(parsed.data);

    const [nominations, winners] = await Promise.all([
      nominationRepository.countByAwardId(award.id),
      winnerRepository.countByAwardId(award.id),
    ]);
    const count = nominations + winners;
    if (count > 0) {
      throw new ConflictError(
        `${award.name} has ${count} ${count === 1 ? 'nomination or winner' : 'nominations or winners'}; remove ${count === 1 ? 'it' : 'them'} first`,
      );
    }

    await awardRepository.deleteById(award.id);

    revalidatePath(`/award-shows/${abbreviation}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
