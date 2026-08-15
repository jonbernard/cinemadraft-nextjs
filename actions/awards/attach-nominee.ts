'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ConflictError } from '@/lib/errors';
import { nominationRepository } from '@/lib/repositories/nominations';
import { resolveFilm } from '@/lib/services/film-ingest';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeAward } from './guard';

const Input = z
  .object({
    awardId: z.int().positive(),
    /**
     * A film already cached locally. Exactly one of `movieId` / `tmdbId` is
     * given — search returns both kinds of result.
     */
    movieId: z.int().positive().optional(),
    /** A film TMDB knows and this app has not cached yet; it gets ingested. */
    tmdbId: z.string().trim().min(1).max(20).optional(),
    year: z.int().positive(),
    /** The person, for categories that nominate one. */
    detailName: z.string().trim().min(1).max(200).optional(),
    detailCharacter: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => input.movieId != null || input.tmdbId != null, {
    message: 'a film is required',
  });

export type AttachNomineeInput = z.infer<typeof Input>;

/**
 * Put a film forward for an award (§12).
 *
 * 🔴 Admin-only. The source app's equivalent was open to the entire internet,
 * and a nomination is worth points to whoever drafted the film — so this
 * endpoint could move every league's standings without a session.
 */
export async function attachNominee(
  input: AttachNomineeInput,
): Promise<ActionResult<{ nominationId: number }>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that nomination is not valid');

  try {
    const { award, abbreviation } = await authorizeAward(parsed.data.awardId);

    // 🔴 Caches the film from TMDB if this is the first time anyone has used
    // it. Nominations season is exactly when a brand-new release gets entered,
    // so this is the common path in January, not an edge case.
    const movie = await resolveFilm({
      movieId: parsed.data.movieId,
      tmdbId: parsed.data.tmdbId,
    });

    // 🔴 `nominations.year` is TEXT, unlike every other year column.
    const year = String(parsed.data.year);

    // Some categories nominate a *person*, not just a film — acting and most
    // craft awards. Storing a null there silently produces a category listing
    // four films and a blank, which reads as a data-entry mistake nobody made.
    if (award.requiresNomineeName === true && !parsed.data.detailName) {
      throw new ConflictError(`${award.name} needs the name of the person nominated`);
    }

    const existing = await nominationRepository.findByAwardMovieYear(
      award.id,
      movie.id,
      year,
    );
    if (existing) {
      // A double-click during a live announcement, which would otherwise
      // double that film's points for this category.
      throw new ConflictError(
        `${movie.title ?? 'That film'} is already nominated for ${award.name}`,
      );
    }

    const nomination = await nominationRepository.create({
      movieId: movie.id,
      awardId: award.id,
      year,
      detailName: parsed.data.detailName ?? null,
      detailCharacter: parsed.data.detailCharacter ?? null,
    });

    revalidatePath(`/award-shows/${abbreviation}`, 'layout');
    return ok({ nominationId: nomination.id });
  } catch (error) {
    return toActionResult(error);
  }
}
