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
    /** TMDB's person id, when the person was chosen from the film's credits. */
    detailId: z.int().positive().optional(),
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

    const year = parsed.data.year;

    // Some categories nominate a *person*, not just a film — acting and most
    // craft awards. Storing a null there silently produces a category listing
    // four films and a blank, which reads as a data-entry mistake nobody made.
    if (award.requiresNomineeName === true && !parsed.data.detailName) {
      throw new ConflictError(`${award.name} needs the name of the person nominated`);
    }

    // 🔴 A duplicate is the same film for the same PERSON, not the same film.
    // One film can hold two nominations in one category — *One Battle After
    // Another*, Best Supporting Actor 2026, for Benicio del Toro and for Sean
    // Penn — and refusing the second made that shape impossible to enter here.
    // What is still refused is a double-click during a live announcement,
    // which would double that film's points for this category.
    const existing = await nominationRepository.findManyByAwardMovieYear(
      award.id,
      movie.id,
      year,
    );
    const duplicate = existing.find((nomination) => samePerson(nomination, parsed.data));
    if (duplicate) {
      const who = duplicate.detailName ? ` for ${duplicate.detailName}` : '';
      throw new ConflictError(
        `${movie.title ?? 'That film'} is already nominated${who} for ${award.name}`,
      );
    }

    const nomination = await nominationRepository.create({
      movieId: movie.id,
      awardId: award.id,
      year,
      detailName: parsed.data.detailName ?? null,
      detailCharacter: parsed.data.detailCharacter ?? null,
      detailId: parsed.data.detailId ?? null,
    });

    revalidatePath(`/award-shows/${abbreviation}`, 'layout');
    return ok({ nominationId: nomination.id });
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Whether an existing nomination names the person being attached.
 *
 * By TMDB person id when both have one — two people can share a name, and one
 * person's name can be spelled two ways across seasons. By name otherwise,
 * case-insensitively, because 3 of the restored named rows carry no id. Two
 * nominations naming nobody are the same person: that is the film-only
 * category's double-click.
 */
function samePerson(
  existing: { detailId: number | null; detailName: string | null },
  input: { detailId?: number; detailName?: string },
): boolean {
  if (existing.detailId != null && input.detailId != null) {
    return existing.detailId === input.detailId;
  }
  const name = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
  return name(existing.detailName) === name(input.detailName);
}
