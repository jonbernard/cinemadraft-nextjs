'use server';

import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { type FilmPerson, fetchTmdbFilmPeople } from '@/lib/external/tmdb-film';
import { type ActionResult, fail, ok, toActionResult } from '../result';

export type { FilmPerson } from '@/lib/external/tmdb-film';

const Input = z
  .string()
  .trim()
  .regex(/^\d{1,12}$/);

/**
 * The people a nomination can name, for a film chosen in the admin (§12).
 *
 * Admin-only, unlike the film search: the answer is public, but the request
 * spends this app's TMDB key, and nothing but the nominations form asks.
 *
 * NOT_FOUND when TMDB cannot answer — a film with no TMDB id never reaches
 * here, because the caller has nothing to send.
 */
export async function filmPeopleAction(
  tmdbId: string,
): Promise<ActionResult<FilmPerson[]>> {
  const parsed = Input.safeParse(tmdbId);
  if (!parsed.success) return fail('INVALID', 'that film is not valid');

  try {
    await requireAdmin();
    const people = await fetchTmdbFilmPeople(parsed.data);
    if (!people)
      return fail('NOT_FOUND', 'TMDB did not answer for that film — try again');
    return ok(people);
  } catch (error) {
    return toActionResult(error);
  }
}
