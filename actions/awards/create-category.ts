'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { awardRepository } from '@/lib/repositories/awards';
import { eventRepository } from '@/lib/repositories/events';
import { pointRepository } from '@/lib/repositories/points';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({
  eventId: z.int().positive(),
  name: z.string().trim().min(1).max(200),
  /**
   * A `points.id`, chosen from a tier list — never a point value (D41). The
   * source form posted a number straight into `awards.points`, which is the
   * column that lies about what it holds: "Performance by an Ensemble" stores
   * `1`, the Alphabet tier-3 row, worth 5. Null is legitimate — a brand-new
   * category with no tier assigned yet scores nothing until one is set.
   */
  pointsId: z.int().positive().nullable(),
  active: z.boolean(),
  requiresNomineeName: z.boolean(),
});

export type CreateCategoryInput = z.infer<typeof Input>;

/**
 * Add a category to a show (T27).
 *
 * 🔴 Admin-only. The source `POST /awards` was `Awards.create(req.body)` —
 * unfiltered mass assignment, open to anyone with curl — and this whitelists
 * exactly the fields the admin screen offers.
 *
 * 🔴 `pointsId` is validated against `pointRepository`, not trusted as "some
 * number the client sent". A tier id that does not exist would sit in the
 * column looking exactly like a real one — `resolvePoints` in
 * `award-show.ts` treats a miss as worth zero — and the category would silently
 * score nothing until someone noticed a total that never moves.
 */
export async function createCategory(
  input: CreateCategoryInput,
): Promise<ActionResult<{ awardId: number }>> {
  try {
    const admin = await requireAdmin();

    const parsed = Input.safeParse(input);
    if (!parsed.success) return fail('INVALID', 'that category is not valid');

    const event = await eventRepository.findById(parsed.data.eventId);

    if (parsed.data.pointsId != null) {
      await pointRepository.findById(parsed.data.pointsId);
    }

    const award = await awardRepository.create({
      name: parsed.data.name,
      eventId: event.id,
      pointsId: parsed.data.pointsId,
      active: parsed.data.active,
      requiresNomineeName: parsed.data.requiresNomineeName,
    });

    console.warn('[awards] category created', {
      by: admin.id,
      awardId: award.id,
      eventId: event.id,
    });

    revalidatePath(`/award-shows/${event.abbreviation}`, 'layout');
    return ok({ awardId: award.id });
  } catch (error) {
    return toActionResult(error);
  }
}
