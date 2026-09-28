'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { deleteMyReview } from '@/lib/services/reviews';
import { FILM_PAGE_ROUTE } from '@/lib/utils/film-href';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({
  tmdbId: z.string().trim().regex(/^\d+$/, 'a TMDB id is required').max(20),
});

export type DeleteReviewInput = z.infer<typeof Input>;

/**
 * Remove the caller's own review of a film.
 *
 * 🔴 Addressed by film, not by review id. A row id arriving from the client is
 * a request, not proof of ownership — the source's own delete-shaped routes
 * (`DELETE /watchlist/item/:id`) took one and never asked whose it was. There is
 * no id to tamper with here: the pair `(caller, film)` names at most one row,
 * and it is always the caller's.
 */
export async function deleteReview(
  input: DeleteReviewInput,
): Promise<ActionResult<null>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that film is not valid');

  try {
    const user = await requireUser();
    await deleteMyReview(user.id, parsed.data.tmdbId);

    // Every film page's cache entry, whatever spelling a reader holds (D133).
    revalidatePath(FILM_PAGE_ROUTE, 'page');

    return ok(null);
  } catch (error) {
    return toActionResult(error);
  }
}
