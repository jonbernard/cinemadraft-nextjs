/** Half a star to five, the precision the source's control offered. */
export const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

/**
 * The nearest step to an arbitrary number.
 *
 * 🔴 `reviews.rating` is an unconstrained `numeric`, so a row can hold 4.37 — a
 * value no radio in `RatingInput` represents, which would leave the group with
 * nothing checked at all and then be refused on save. Zero collapses to no
 * rating rather than to half a star: the column's zero is the absence of a
 * score, which is what `save-review.ts` refuses.
 */
export function toRatingStep(value: number | null): number | null {
  if (value === null || value <= 0) return null;

  return RATING_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );
}
