'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import {
  type AvailableYear,
  availableYearRepository,
} from '@/lib/repositories/available-years';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.int().positive();

/**
 * Start the next season: create its `available_years` row and make it active
 * (D138). This is what unblocks every league owner's "Open <year>" (D131),
 * which is offered only once the site's active year is the league's newest + 1.
 *
 * `year` is the season the confirmation named. The repository refuses any year
 * but active + 1 and answers `started: false` for the active one, so a second
 * press, or a stale tab, writes nothing and never creates the year after.
 *
 * Admin-only, checked here rather than trusted to the page: a Server Action's
 * id ships in the client bundle (see `app/(app)/admin/season/page.tsx`).
 */
export async function startNextSeason(
  year: number,
): Promise<ActionResult<{ season: AvailableYear; started: boolean }>> {
  try {
    const admin = await requireAdmin();

    const parsed = Input.safeParse(year);
    if (!parsed.success) return fail('INVALID', 'that is not a season');

    const result = await availableYearRepository.startNext(parsed.data);
    if (result.started) {
      console.warn('[season] next season started', { by: admin.id, year: parsed.data });
      revalidatePath('/', 'layout');
    }
    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}
