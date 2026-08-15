'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ConflictError } from '@/lib/errors';
import { draftPickRepository } from '@/lib/repositories/draft-picks';
import { draftRepository } from '@/lib/repositories/drafts';
import { resolveFilm } from '@/lib/services/film-ingest';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeSeat } from './guard';

const Input = z
  .object({
    draftId: z.int().positive(),
    /** A film already cached locally. */
    movieId: z.int().positive().optional(),
    /** A film TMDB knows and this app has not cached yet; it gets ingested. */
    tmdbId: z.string().trim().min(1).max(20).optional(),
  })
  .refine((input) => input.movieId != null || input.tmdbId != null, {
    message: 'a film is required',
  });

export type AddPickInput = z.infer<typeof Input>;

/**
 * Give a seat a film.
 *
 * The round is **not** an input. The source route took `order` from the
 * request body, which means the number that decides where a film sits on the
 * board was whatever the client last rendered — send a stale one and two picks
 * share a round. Here the seat's own picks decide it: the next round is one
 * past the highest the seat holds. No count is involved (D34); a seat can be
 * on its sixth pick or its thirtieth.
 *
 * 🔴 **A film may not be taken twice inside a group.** The source app enforced
 * nothing, and the whole point of the draft is that a film is gone once
 * someone takes it — losing that to a double-entry mid-call is exactly the
 * mistake a live video call produces. The scope is the *group*, not the
 * league, and that is measured rather than assumed: across all 1025 picks in
 * production, no film is ever repeated within a group, while films are
 * routinely taken by several groups of the same league in the same year (25
 * films in league 1's 2017 season were taken five times each). Each group is
 * its own independent draft, so league-wide uniqueness would refuse writes the
 * league has always made.
 */
export async function addPick(
  input: AddPickInput,
): Promise<ActionResult<{ pickId: number }>> {
  const parsed = Input.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that pick is not valid');

  try {
    const { seat, leagueId } = await authorizeSeat(parsed.data.draftId);

    // 🔴 Caches the film from TMDB if nobody has drafted it before. `movies` is
    // a cache of TMDB, so a film the league has never used simply is not there
    // yet — and a draft is one of the two moments it gets added.
    const movie = await resolveFilm({
      movieId: parsed.data.movieId,
      tmdbId: parsed.data.tmdbId,
    });

    const groupSeats = (
      await draftRepository.findByLeagueIdAndYear(leagueId, seat.year ?? 0)
    ).filter((other) => (other.group ?? 1) === (seat.group ?? 1));

    const taken = await draftPickRepository.findManyByDraftIds(
      groupSeats.map((other) => other.id),
    );
    if (taken.some((pick) => pick.movieId === movie.id)) {
      throw new ConflictError(
        `${movie.title ?? 'that film'} is already taken in this group`,
      );
    }

    const own = taken.filter((pick) => pick.draftId === seat.id);
    const nextRound =
      own.reduce((highest, pick) => Math.max(highest, pick.order ?? 0), 0) + 1;

    const pick = await draftPickRepository.create({
      draftId: seat.id,
      movieId: movie.id,
      order: nextRound,
      // The seat's member, not the acting owner. Where production rows carry a
      // `user_id` at all it always equals the seat's — 638 of 1025 rows, none
      // of them differing — so writing the owner's id here would invent a
      // relationship the column has never expressed. Null for a dummy seat.
      userId: seat.userId,
    });

    // 'layout' so the owner's console at /leagues/:id/draft refreshes too,
    // not only the public board. A Server Action called from a client
    // component carries the revalidated tree back with its response, which is
    // what makes the console advance without a manual refresh.
    revalidatePath(`/leagues/${leagueId}`, 'layout');
    return ok({ pickId: pick.id });
  } catch (error) {
    return toActionResult(error);
  }
}
