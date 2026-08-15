'use server';

import { z } from 'zod';

import { movieRepository } from '@/lib/repositories/movies';
import { posterUrl } from '@/lib/utils/poster';
import { type ActionResult, ok, toActionResult } from '../result';

export type FilmResult = {
  id: number;
  title: string;
  year: number | null;
  posterUrl: string | null;
};

const Input = z.string().trim().min(1).max(120);

/**
 * Find a film by part of its title.
 *
 * 🔴 Partial titles are the requirement, not a nicety. The owner is typing
 * what someone just said out loud on a call — "the one about the octopus" is
 * not searchable, but "octo" has to be.
 *
 * Ungated on purpose. The result is the public film list, the same rows any
 * league page already renders, so a session check here would protect nothing
 * and would stop the console working for an owner whose session is mid-refresh.
 * The *writes* are gated; this is a read.
 *
 * Phase 8 replaces the source with the real local-first + TMDB search (§10).
 * The shape returned here is what that phase must keep, so the console does
 * not change when the search behind it does.
 */
export async function searchFilms(query: string): Promise<ActionResult<FilmResult[]>> {
  const parsed = Input.safeParse(query);
  // An empty box is not an error — it is the state the field starts in.
  if (!parsed.success) return ok([]);

  try {
    const movies = await movieRepository.search(parsed.data, 12);
    return ok(
      movies.map((movie) => ({
        id: movie.id,
        title: movie.title ?? 'Untitled',
        year: movie.releaseDate ? movie.releaseDate.getUTCFullYear() : null,
        posterUrl: posterUrl(movie.poster, 'w92'),
      })),
    );
  } catch (error) {
    return toActionResult(error);
  }
}
