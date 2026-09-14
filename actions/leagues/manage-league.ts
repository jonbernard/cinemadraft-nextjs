'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ConflictError } from '@/lib/errors';
import { draftRepository } from '@/lib/repositories/drafts';
import { leagueRepository } from '@/lib/repositories/leagues';
import { profileFeedRepository } from '@/lib/repositories/profile-feeds';
import { getLeagueBoard } from '@/lib/services/draft';
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
 * Mark the draft finished (P10.T17), and post each member's roster to their
 * profile feed.
 *
 * 🔴 **The feed post is the point of this action as much as the status is.**
 * The source wrote one `profile_feeds` row per seated member here
 * (`server/routes/league.js:62-86`), and in the restored production data
 * **every one of the 125 feed rows came from this write** — 19 members,
 * 2016-11-01 to 2023-12-04, and not one post from the manual composer. Omitting
 * it left the port rendering an attachment kind nothing would ever create, and
 * it went unnoticed because `PARITY.md` carried the deferral as an italic aside
 * inside a row marked ported rather than as a row of its own.
 *
 * 🔴 **The league's real season, not the source's hardcoded `year: 2024`**
 * (`PARITY.md` bug 7). `Status` already carries the year, so there is no
 * literal to inherit.
 *
 * 🔴 **Written only on the transition into `complete`.** The source re-posted
 * on every update, which is why the same roster appears twice in the data.
 * Reading the status first and writing only when it changes makes pressing
 * "Finish the draft" twice harmless — and a member's feed is the one surface
 * where a duplicate is visible forever.
 *
 * 🔴 **A failed post does not fail the action.** The status change is the thing
 * the owner asked for and it is already committed; a feed row is a
 * consequence. Throwing here would report failure for an operation that
 * succeeded, and the owner would press it again — producing the duplicate the
 * guard above exists to prevent.
 */
export async function completeDraft(
  input: z.infer<typeof Status>,
): Promise<ActionResult> {
  const parsed = Status.safeParse(input);
  if (!parsed.success) return fail('INVALID', 'that league is not valid');

  try {
    const { league } = await authorizeLeague(parsed.data.leagueId);
    const wasComplete = league.draftingStatus === 'complete';

    await leagueRepository.update(parsed.data.leagueId, { draftingStatus: 'complete' });

    if (!wasComplete) {
      await postRosters(parsed.data.leagueId, parsed.data.year, league.name);
    }

    revalidatePath(`/leagues/${parsed.data.leagueId}`, 'layout');
    revalidatePath('/members', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * One feed row per seated member, naming what they drafted.
 *
 * 🔴 Dummy seats are skipped, and that is the whole of the filter: `uuid` is
 * null for a seat the owner drafts on behalf of, and `profile_feeds` is keyed
 * by `user_uuid`, so there is nowhere to put the row. 17 such seats exist in
 * production.
 *
 * The message and the `components` pointer match the source's shape exactly —
 * `[['draft', draftId]]` is what `lib/services/profile.ts` already expands into
 * a roster, so this writes rows the port could already render.
 */
async function postRosters(leagueId: number, year: number, leagueName: string | null) {
  try {
    const board = await getLeagueBoard(leagueId, year);
    const seats = board.groups.flatMap((group) => group.seats);

    await Promise.all(
      seats
        .filter((seat) => seat.uuid != null)
        .map((seat) =>
          profileFeedRepository.create({
            userUuid: seat.uuid as string,
            message: `${seat.name} drafted these movies in the ${year} ${
              leagueName ?? 'league'
            } league.`,
            icon: 'eva:calendar-fill',
            components: [['draft', seat.draftId]],
          }),
        ),
    );
  } catch (error) {
    // Deliberately swallowed — see the action's docstring. The status change
    // has already committed and is what the owner asked for.
    console.error('[league] could not post rosters to the feed', {
      leagueId,
      year,
      error,
    });
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
