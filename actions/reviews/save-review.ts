'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { type MyReview, saveMyReview } from '@/lib/services/reviews';
import { type ActionResult, fail, ok, toActionResult } from '../result';

/**
 * 🔴 Half-star precision, checked rather than assumed. The source's control was
 * a MUI `<Rating precision={0.5}>` and its route stored whatever arrived in
 * `req.body.data` — an unconstrained `numeric` column behind an unvalidated
 * POST, so `rating: 4.37` or `rating: 900` was a stored value. Doubling and
 * testing for an integer is exact for every value this accepts: 4.5 * 2 is 5,
 * and 2.3 * 2 is 4.6.
 *
 * Zero is not a rating, it is the absence of one — MUI's control reports a
 * cleared star row as `null`, and that is what the "No rating" radio sends.
 */
const Rating = z
  .number()
  .min(0.5, 'a rating runs from half a star to five')
  .max(5, 'a rating runs from half a star to five')
  .refine((value) => Number.isInteger(value * 2), 'half stars only')
  .nullable();

const Input = z.object({
  tmdbId: z.string().trim().regex(/^\d+$/, 'a TMDB id is required').max(20),
  rating: Rating,
  review: z.string().max(20_000).nullable(),
});

export type SaveReviewInput = z.infer<typeof Input>;

/**
 * Save a member's rating and words for one film, replacing what they had.
 *
 * The share-to-profile switch the source's form carried is not here: it wrote a
 * `profile_feeds` row, and the feed is P10.T40's to build.
 */
export async function saveReview(
  input: SaveReviewInput,
): Promise<ActionResult<MyReview>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) {
    return fail('INVALID', parsed.error.issues[0]?.message ?? 'that review is not valid');
  }

  const words = parsed.data.review?.trim() ?? '';
  const draft = { rating: parsed.data.rating, review: words === '' ? null : words };
  // A row with neither a score nor words is a review of nothing. Removing one is
  // `deleteReview`, so an empty save is a mistake rather than a deletion.
  if (draft.rating === null && draft.review === null) {
    return fail('INVALID', 'add a rating or a few words');
  }

  try {
    const user = await requireUser();
    const saved = await saveMyReview(user.id, parsed.data.tmdbId, draft);

    revalidatePath(`/films/${parsed.data.tmdbId}`);

    return ok(saved);
  } catch (error) {
    return toActionResult(error);
  }
}
