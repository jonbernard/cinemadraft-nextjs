'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { eventDateRepository } from '@/lib/repositories/event-dates';
import { eventRepository } from '@/lib/repositories/events';
import { getActiveYear } from '@/lib/services/season';
import { inSeason } from '@/lib/utils/season-window';
import { type ActionResult, fail, ok, toActionResult } from '../result';

/**
 * 🔴 The whitelist. `PUT /events/:abbreviation` in the source app was
 * `Events.update(req.body, …)` — unfiltered mass assignment, `id` and `fbId`
 * included. Every field here is one the admin screen actually offers; `id`
 * is the URL param, never the body, and nothing lets a caller touch `fbId`,
 * `createdAt` or `updatedAt`.
 *
 * Schedule fields take `number | null` — epoch milliseconds — matching
 * `Event` on the read side; the repository is what turns them back into
 * bigint for Postgres.
 */
const Input = z.object({
  eventId: z.int().positive(),
  name: z.string().trim().min(1).max(200).optional(),
  abbreviation: z.string().trim().min(1).max(50).optional(),
  image: z.string().trim().max(2000).nullable().optional(),
  nomActive: z.boolean().optional(),
  nomDate: z.number().nullable().optional(),
  nomTime: z.number().nullable().optional(),
  nomDuration: z.number().nullable().optional(),
  awardsActive: z.boolean().optional(),
  awardsDate: z.number().nullable().optional(),
  awardsTime: z.number().nullable().optional(),
  awardsDuration: z.number().nullable().optional(),
  // False for a show that names honourees and holds no ceremony (D129).
  hasCeremony: z.boolean().optional(),
  /** The dates of one season (D134): the dialog's, for the page's `?year=`. */
  season: z
    .object({
      year: z.int().positive(),
      nomDate: z.number().nullable(),
      nomTime: z.number().nullable(),
      awardsDate: z.number().nullable(),
      awardsTime: z.number().nullable(),
    })
    .optional(),
});

export type UpdateEventInput = z.infer<typeof Input>;

type SeasonDates = NonNullable<UpdateEventInput['season']>;

/** Why a season's dates cannot be saved, or null. Dates are UTC midnight of the day. */
function seasonProblem(season: SeasonDates, hasCeremony: boolean): string | null {
  const { year, nomDate, nomTime, awardsDate, awardsTime } = season;
  const window = `the ${year} season (1 August ${year - 1} to 31 July ${year})`;
  if (nomDate != null && !inSeason(nomDate, year))
    return `The nominations date is outside ${window}`;
  if (awardsDate != null && !hasCeremony) return 'This show has no ceremony to date';
  if (awardsDate != null && !inSeason(awardsDate, year))
    return `The awards date is outside ${window}`;
  if (
    nomDate != null &&
    awardsDate != null &&
    nomDate + (nomTime ?? 0) > awardsDate + (awardsTime ?? 0)
  )
    return 'The nominations cannot come after the awards';
  return null;
}

/**
 * Edit a show's dates and live flags (T26), and one season's dates (D134).
 *
 * 🔴 Admin-only, checked before the input is even parsed — `restrictToAdmin`
 * guarded the source route the same way.
 *
 * `awardsActive` is what decides whether a ceremony is live; `nomActive` is
 * still accepted but read by nothing (needs-nominations is derived from dates,
 * `lib/services/entry-status.ts`), and the app's own form no longer sends it.
 * The source also had `resetActiveEvents`, which cleared every show's active
 * flags at once to keep one live at a time — but nothing in the schema
 * enforces that, and this action does not invent a constraint that was never
 * there. Two shows active simultaneously is existing behaviour (T3, deferred
 * to Phase 14).
 */
export async function updateEvent(input: UpdateEventInput): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();

    const parsed = Input.safeParse(input);
    if (!parsed.success) return fail('INVALID', 'that show is not valid');

    const { eventId, season, ...fields } = parsed.data;

    // 🔴 `abbreviation` has no `@unique` in the schema, and it is also the
    // primary lookup key (`findByAbbreviation` is `findFirst`): a collision
    // would silently shadow another show, whose URL would then render this
    // one's data. Refuse rather than let two shows share a slug.
    if (fields.abbreviation !== undefined) {
      const collision = await eventRepository.findByAbbreviation(fields.abbreviation);
      if (collision && collision.id !== eventId) {
        return fail(
          'CONFLICT',
          `"${fields.abbreviation}" is already used by another show`,
        );
      }
    }

    if (season) {
      // A time means nothing without its date.
      season.nomTime = season.nomDate == null ? null : season.nomTime;
      season.awardsTime = season.awardsDate == null ? null : season.awardsTime;
      const hasCeremony =
        fields.hasCeremony ?? (await eventRepository.findById(eventId)).hasCeremony;
      const problem = seasonProblem(season, hasCeremony);
      if (problem) return fail('INVALID', problem);

      // 🔴 `events` holds the active season's schedule, which the calendar
      // feed, "still to enter", the live panel and the season rail read. So a
      // past or future season's dates never reach it; and, as in the
      // award-entry skill, a date left empty never nulls it — the show keeps
      // its usual time for next year's `set-dates`.
      if (season.year === (await getActiveYear())) {
        if (season.nomDate != null) {
          fields.nomDate = season.nomDate;
          fields.nomTime = season.nomTime;
        }
        if (season.awardsDate != null) {
          fields.awardsDate = season.awardsDate;
          fields.awardsTime = season.awardsTime;
        }
      }
    }

    const updated = await eventRepository.update(eventId, fields);
    if (season) {
      const { year, ...dates } = season;
      await eventDateRepository.save(year, eventId, dates);
    }

    console.warn('[events] admin edit', { by: admin.id, eventId });

    revalidatePath(`/award-shows/${updated.abbreviation}`, 'layout');
    revalidatePath('/award-shows', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
