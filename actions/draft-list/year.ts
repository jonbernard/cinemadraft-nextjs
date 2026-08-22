import { z } from 'zod';

/**
 * A season, as a number rather than whatever a URL segment happened to hold.
 *
 * 🔴 Source bug 10: `POST /lists/:year` accepted any single path segment as a
 * year and then ignored it. The range is deliberately wider than the app's own
 * seasons — the *real* check is that the year exists in `available_years`, and
 * that lives in `lib/services/draft-list.ts` where the table is readable. This
 * one only keeps a nonsensical value out of a database query.
 */
export const Year = z.int().min(1900).max(2200);
