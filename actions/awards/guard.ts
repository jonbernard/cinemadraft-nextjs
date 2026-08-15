import { requireAdmin } from '@/lib/auth';
import { NotFoundError } from '@/lib/errors';
import { type Award, awardRepository } from '@/lib/repositories/awards';
import { eventRepository } from '@/lib/repositories/events';

/**
 * 🔴 The gate in front of every write to the scoring inputs.
 *
 * Nominations and winners are what scoring is computed from, so a bad write
 * here changes every league's standings at once (§12). The source app left
 * `POST`/`DELETE` on **both** tables completely unauthenticated — no
 * middleware, and `createResponse` adds none — while the sibling writes in
 * `awards.js` and `events.js` did use `restrictToAdmin`. Anyone on the
 * internet could declare a winner (`PARITY.md` bug 1).
 *
 * Not a `'use server'` module: nothing here is callable from a browser. It is
 * the shared first act of the award actions, so "may this person change the
 * scoring inputs" is answered in one place and cannot be answered differently
 * by one of them.
 */
export type AwardControl = {
  /** The acting admin. */
  userId: number;
  award: Award;
  /** For revalidating the page this category appears on. */
  abbreviation: string;
};

/**
 * Authorize a write against a category, and resolve the show it belongs to.
 *
 * The show is derived from the award rather than accepted from the caller, for
 * the same reason the draft actions derive a league from its seat: two facts
 * from one untrusted payload can disagree, and then the thing checked is not
 * the thing written.
 */
export async function authorizeAward(awardId: number): Promise<AwardControl> {
  const admin = await requireAdmin();
  const award = await awardRepository.findById(awardId);

  const event = await eventRepository.findById(award.eventId);
  if (!event) throw new NotFoundError('award show for award', awardId);

  return { userId: admin.id, award, abbreviation: event.abbreviation };
}
