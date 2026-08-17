'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth';
import { watchlistRepository } from '@/lib/repositories/watchlists';
import { ensureFilm } from '@/lib/services/film-ingest';
import { type ActionResult, fail, ok, toActionResult } from '../result';

const Input = z.object({
  /**
   * A TMDB id, because every surface that offers this holds one: a browse
   * poster, a film page, a similar-films tile. None of them has a local id —
   * most of those films are not in `movies` at all.
   */
  tmdbId: z.string().trim().regex(/^\d+$/, 'a TMDB id is required').max(20),
  /** The state being asked for, not a toggle. */
  watched: z.boolean(),
});

export type SetWatchedInput = z.infer<typeof Input>;

/**
 * Mark a film watched, or unmark it.
 *
 * 🔴 **"Watchlist" here means *films you have watched*** (D64), not films you
 * intend to watch. Read out of the source rather than inferred from the table
 * name: its button is titled "Mark as watched" / "Watched!", its toast reads
 * "Marked as watched", and the action it offers next is "Write a review" —
 * reviews hang off these same rows. So the green `+` on a browse poster means
 * *I have seen this*, and it becomes a check.
 *
 * 🔴 **It takes the state, not a toggle.** The source's button decided which
 * request to send from its own local state (`WatchButton.js`), so a stale badge
 * sent the wrong one: pressing an out-of-date check issued a delete for a row
 * that had already gone, and pressing an out-of-date plus created a second row.
 * Naming the desired end state makes the write idempotent in both directions and
 * lets two open tabs converge instead of fighting.
 *
 * 🔴 **This one ingests the film, unlike the film page** (D63). The distinction
 * is who caused the write: a page render is anonymous traffic that may well be a
 * crawler, while this is a logged-in member pressing a button — and the local
 * row has to exist before a watchlist entry can point at it. Ingesting also
 * refuses cleanly when TMDB does not know the id, which matters because
 * `watchlists.movie_id` has no foreign key and a bad id would be stored happily
 * and show as a blank row forever.
 *
 * Anonymous callers are refused rather than redirected. Every page that offers
 * this is public, so reaching here without a session is ordinary — the badge
 * simply is not rendered when logged out.
 */
export async function setWatched(
  input: SetWatchedInput,
): Promise<ActionResult<{ watched: boolean }>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that film is not valid');

  try {
    const user = await requireUser();
    const movie = await ensureFilm(parsed.data.tmdbId);

    if (parsed.data.watched) {
      await watchlistRepository.add(user.id, movie.id);
    } else {
      await watchlistRepository.deleteByUserAndMovie(user.id, movie.id);
    }

    // The three surfaces that render the badge or the list. Named individually
    // rather than revalidating a layout: these are unrelated routes, and
    // `/films/[tmdbId]` is public and cached, so it needs its own mention.
    revalidatePath('/browse');
    revalidatePath('/watchlist');
    revalidatePath(`/films/${parsed.data.tmdbId}`);

    return ok({ watched: parsed.data.watched });
  } catch (error) {
    return toActionResult(error);
  }
}
