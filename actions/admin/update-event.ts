'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/auth';
import { eventRepository } from '@/lib/repositories/events';
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
  liveResults: z.boolean().optional(),
});

export type UpdateEventInput = z.infer<typeof Input>;

/**
 * Edit a show's dates and live flags (T26).
 *
 * 🔴 Admin-only, checked before the input is even parsed — `restrictToAdmin`
 * guarded the source route the same way.
 *
 * `nomActive` / `awardsActive` are what decide whether a ceremony is live.
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

    const { eventId, ...fields } = parsed.data;

    const updated = await eventRepository.update(eventId, fields);

    console.warn('[events] admin edit', { by: admin.id, eventId });

    revalidatePath(`/award-shows/${updated.abbreviation}`, 'layout');
    revalidatePath('/award-shows', 'layout');
    return ok();
  } catch (error) {
    return toActionResult(error);
  }
}
