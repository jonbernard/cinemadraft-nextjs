'use server';

import { z } from 'zod';

import { type FilmResult, findFilms } from '@/lib/services/search';
import { type ActionResult, ok, toActionResult } from '../result';

export type { FilmResult } from '@/lib/services/search';

const Input = z.object({
  query: z.string().trim().min(1).max(120),
  context: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('draft'),
      year: z.int().positive(),
      takenMovieIds: z.array(z.int().positive()).max(500),
    }),
    z.object({ kind: z.literal('browse') }),
    z.object({ kind: z.literal('award-admin'), year: z.int().positive() }),
  ]),
});

export type FindFilmsInput = z.infer<typeof Input>;

/**
 * The typeahead's data path (§10).
 *
 * Ungated, deliberately. The result is the public film list — the same rows
 * every league page already renders — so a session check here would protect
 * nothing and would break the console for an owner whose session is mid-
 * refresh. The *writes* are gated; this is a read.
 *
 * Replaces `actions/draft/search-films.ts`, which searched local titles with a
 * plain `contains` and had no notion of context. Same shape, so the console did
 * not change; better answers, because the ranking rule now knows whether it is
 * being asked during a draft, a browse, or a nomination.
 */
export async function findFilmsAction(
  input: FindFilmsInput,
): Promise<ActionResult<FilmResult[]>> {
  const parsed = Input.safeParse(input);
  // An empty or overlong box is not an error — it is the state the field
  // starts in, and the state it reaches when someone pastes an essay.
  if (!parsed.success) return ok([]);

  try {
    return ok(await findFilms(parsed.data.query, parsed.data.context));
  } catch (error) {
    return toActionResult(error);
  }
}
