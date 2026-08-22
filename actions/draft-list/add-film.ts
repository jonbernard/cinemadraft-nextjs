'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { addToDraftList } from '@/lib/services/draft-list';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { Year } from './year';

const Input = z
  .object({
    year: Year,
    /** A local film, when search found one already in the catalogue. */
    movieId: z.int().positive().optional(),
    /** A film only TMDB knows, which is ingested on the way through. */
    tmdbId: z.string().trim().regex(/^\d+$/).max(20).optional(),
  })
  .refine((value) => value.movieId != null || value.tmdbId != null, {
    message: 'a film is required',
  });

export type AddFilmInput = z.infer<typeof Input>;

/**
 * Put a film on the caller's shortlist for a season.
 *
 * The list is private, so there is nothing to authorize beyond having a
 * session: a member can only ever write to their own.
 */
export async function addFilmToList(
  input: AddFilmInput,
): Promise<ActionResult<{ entryId: number }>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that film is not valid');

  try {
    const user = await requireUser();
    const entry = await addToDraftList({ userId: user.id, ...parsed.data });

    revalidatePath('/list');
    return ok({ entryId: entry.entryId });
  } catch (error) {
    return toActionResult(error);
  }
}
