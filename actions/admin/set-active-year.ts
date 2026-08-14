'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth';
import {
  type AvailableYear,
  availableYearRepository,
} from '@/lib/repositories/available-years';

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
 */
export async function setActiveYear(year: number): Promise<AvailableYear> {
  const admin = await requireAdmin();

  const updated = await availableYearRepository.setActive(year);

  // Changing the season re-scopes essentially every page, and it happens once
  // a year — worth recording who did it.
  console.warn('[season] active year changed', { by: admin.id, year });

  revalidatePath('/', 'layout');
  return updated;
}
