import { z } from 'zod';

/**
 * Wider than the app's own seasons on purpose: `requireSeason` is the real
 * check. This only keeps a nonsensical value out of a database query.
 */
export const Year = z.int().min(1900).max(2200);
