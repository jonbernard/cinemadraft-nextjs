'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ConflictError } from '@/lib/errors';
import { draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { type ActionResult, fail, ok, toActionResult } from '../result';
import { authorizeLeague } from './guard';

const Settings = z.object({
  leagueId: z.int().positive(),
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(['snake', 'linear']).optional(),
});

/**
 * Change a league's settings (P10.T19).
 *
 * 🔴 **Named fields only.** The source's `PUT /league/:id` passed `req.body`
 * straight to the update (`PARITY.md` bug 6), so a request could set `owner` —
 * the column every ownership check reads — and take the league. Zod's schema
 * is the allowlist here, and `leagueRepository.update` accepts named arguments
 * rather than an object, so there is no path that forwards a body.
 */
export async function updateLeagueSettings(
  input: z.infer<typeof Settings>,
): Promise<ActionResult> {
  const parsed = Settings.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'those settings are not valid');

  try {
    await authorizeLeague(parsed.data.leagueId);

    await leagueRepository.update(parsed.data.leagueId, {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
    });

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    revalidatePath('/leagues');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

const Status = z.object({
  leagueId: z.int().positive(),
  year: z.int().positive(),
});

/**
 * Open the draft (P10.T17).
 *
 * 🔴 **Changes the status and nothing else.** The source's equivalent also
 * inserted a `drafts` row for the caller on every call (`PARITY.md` bug 6), so
 * an owner who clicked twice acquired two seats — and a status that could not
 * be set without side effects.
 *
 * Refuses a league with no seats grouped, because a draft with everyone
 * unassigned has no board to draft on: `getLeagueBoard` groups by `group`, and
 * nulls collapse into one group of everybody.
 */
export async function startDraft(input: z.infer<typeof Status>): Promise<ActionResult> {
  const parsed = Status.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that league is not valid');

  try {
    const { league } = await authorizeLeague(parsed.data.leagueId);
    if (league.draftingStatus === 'active') return ok();

    const seats = await draftRepository.findByLeagueIdAndYear(
      parsed.data.leagueId,
      parsed.data.year,
    );
    if (seats.length === 0) {
      throw new ConflictError('nobody is in this league yet');
    }
    if (seats.every((seat) => seat.group == null)) {
      throw new ConflictError('set up the groups before starting the draft');
    }

    await leagueRepository.update(parsed.data.leagueId, { draftingStatus: 'active' });

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Mark the draft finished (P10.T17).
 *
 * The source also posted each member's picks to their profile feed at this
 * point, using a **hardcoded `year: 2024`** (`PARITY.md` bug 7). The feed is
 * batch E; when it lands, this is where it hooks in — with the league's real
 * season, not a literal.
 */
export async function completeDraft(
  input: z.infer<typeof Status>,
): Promise<ActionResult> {
  const parsed = Status.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that league is not valid');

  try {
    await authorizeLeague(parsed.data.leagueId);
    await leagueRepository.update(parsed.data.leagueId, { draftingStatus: 'complete' });

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

const Stage = z.object({
  leagueId: z.int().positive(),
  /** The season being opened, normally the one after the current. */
  year: z.int().positive(),
});

/**
 * Open next season (P10.T18).
 *
 * Copies this league's people into seats for the new year. Membership is a
 * seat, so without this a league's members would have to re-join every
 * January.
 *
 * 🔴 **Safe to run twice.** Anyone already seated for the target year is
 * skipped, so a double click does not double the league. Placeholder seats
 * carry over too — a league that drafts on behalf of someone still does next
 * year.
 *
 * The league goes back to `pending`: a new season has no groups yet.
 */
export async function stageNextSeason(
  input: z.infer<typeof Stage>,
): Promise<ActionResult<{ seated: number }>> {
  const parsed = Stage.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that season is not valid');

  try {
    await authorizeLeague(parsed.data.leagueId);

    const all = await draftRepository.findByLeagueId(parsed.data.leagueId);
    const alreadySeated = new Set(
      all
        .filter((seat) => seat.year === parsed.data.year)
        .map((seat) => seat.userId ?? `dummy:${seat.dummyName}`),
    );

    // The most recent season that is not the one being staged — the roster to
    // carry forward.
    const previousYear = Math.max(
      ...all
        .flatMap((seat) => (seat.year == null ? [] : [seat.year]))
        .filter((year) => year !== parsed.data.year),
      0,
    );
    const roster = all.filter((seat) => seat.year === previousYear);

    let seated = 0;
    for (const seat of roster) {
      const key = seat.userId ?? `dummy:${seat.dummyName}`;
      if (alreadySeated.has(key)) continue;
      alreadySeated.add(key);

      await draftRepository.create({
        leagueId: parsed.data.leagueId,
        year: parsed.data.year,
        userId: seat.userId,
        dummyName: seat.dummy === true ? seat.dummyName : null,
      });
      seated += 1;
    }

    await leagueRepository.update(parsed.data.leagueId, {
      draftingStatus: 'pending',
      activeYear: parsed.data.year,
    });

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    return ok({ seated });
  } catch (error) {
    return toActionResult(error);
  }
}
