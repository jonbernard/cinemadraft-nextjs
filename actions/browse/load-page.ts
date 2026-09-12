'use server';

import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { type BrowsePage, loadBrowse } from '@/lib/services/browse';
import { type ActionResult, fail, ok, toActionResult } from '../result';

export type { BrowsePage } from '@/lib/services/browse';

const Input = z.object({
  when: z.enum(['past', 'future']),
  /**
   * Capped well below TMDB's own 500-page ceiling for the same reason the page
   * component clamps: the number arrives from the client, and an unbounded one
   * is a free upstream request per keystroke of somebody's curl loop.
   */
  page: z.int().positive().max(500),
});

export type LoadBrowsePageInput = z.infer<typeof Input>;

/**
 * One more page of the browse shelf, for the sentinel at the bottom of the list
 * (P15.T7, D80).
 *
 * 🔴 **It resolves the reader itself.** The shelf carries a watched mark per
 * film (D64), and those marks are the reader's own — a `userId` parameter would
 * let any caller ask what somebody else has seen. The session is the only
 * source of that id here, exactly as it is on the server-rendered first page.
 *
 * Ungated, like `findFilmsAction` and for the same reason: browse is public
 * (D44). A signed-out reader gets the same films without the marks.
 */
export async function loadBrowsePage(
  input: LoadBrowsePageInput,
): Promise<ActionResult<BrowsePage>> {
  const parsed = Input.safeParse(input);
  // Unlike the typeahead, a bad page here is not a state the UI passes through
  // on its way to a good one — the sentinel only ever asks for `page + 1`. So
  // it is reported rather than smoothed into an empty answer.
  if (!parsed.success) return fail('INVALID', 'that is not a page of the catalogue');

  try {
    const user = await getCurrentUser();
    return ok(await loadBrowse({ ...parsed.data, userId: user?.id ?? null }));
  } catch (error) {
    return toActionResult(error);
  }
}
