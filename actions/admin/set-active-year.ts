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
 * Move the active season from inside the running app (D22).
 *
 * The repository does the clear-and-set in one transaction, because
 * `available_years_one_active` allows exactly one active row and setting
 * before clearing would fail every time. This layer adds two things the
 * repository should not know about: who is allowed to do it, and what to
 * invalidate afterwards.
 *
 * `revalidatePath('/', 'layout')` rather than a tag, because `getActiveYear`
 * is not cached yet (see its comment and D42). When it moves behind
 * `'use cache'` this becomes `revalidateTag('active-year')` — without that,
 * the admin changes the season, nothing visibly happens, and they conclude
 * the button is broken.
 *
 * On `ActionResult` (P10.T48) rather than the bare `AvailableYear` and throw
 * it predates — it had no callers, so there was nothing to break by moving
 * it onto the convention every other action follows.
 */
export async function setActiveYear(year: number): Promise<ActionResult<AvailableYear>> {
  try {
    const admin = await requireAdmin();

    const parsed = Input.safeParse(year);
    if (!parsed.success) return fail('INVALID', 'that is not a season');

    const updated = await availableYearRepository.setActive(parsed.data);

    // Changing the season re-scopes essentially every page, and it happens
    // once a year — worth recording who did it.
    console.warn('[season] active year changed', { by: admin.id, year: parsed.data });

    revalidatePath('/', 'layout');
    return ok(updated);
  } catch (error) {
    return toActionResult(error);
  }
}
