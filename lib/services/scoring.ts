import { awardRepository } from '@/lib/repositories/awards';
import { nominationRepository } from '@/lib/repositories/nominations';
import { pointRepository } from '@/lib/repositories/points';
import { winnerRepository } from '@/lib/repositories/winners';

/**
 * What the rule needs, with nothing about where it came from.
 *
 * Keeping this a plain value rather than a query result is what lets Phase 9
 * materialize results without a second implementation of the rule.
 */
export type ScoringInput = {
  nominations: readonly { movieId: number; awardId: number }[];
  /** award id → the resolved point value, from `points.points` */
  pointsByAward: ReadonlyMap<number, number>;
  /** award id → the movie ids that won it */
  winnersByAward: ReadonlyMap<number, ReadonlySet<number>>;
};

/**
 * The scoring rule, ported exactly from `server/routes/points.js` (D19, D41).
 *
 *   movie total = Σ over its nominations of  P + (P again if it won that award)
 *   team total  = Σ movie totals
 *
 * So a nomination is worth P and a win is worth **2P**, because a winner was
 * necessarily also nominated.
 *
 * Pure and synchronous on purpose. Phase 9 adds materialized results and
 * bounded recompute; it calls this same function, so there is exactly one
 * definition of the rule and the stored copy cannot drift from what these
 * tests pin.
 *
 * 🔴 `P` must be the **resolved** value from `points`, reached through
 * `award.pointsId`. That column is a FOREIGN KEY into `points.id`, not a point
 * value — "Performance by an Ensemble" stores 1, which is the Alphabet tier-3
 * row and is worth 5. Summing the column directly scores it 1 and quietly
 * corrupts every total in the app. `pointsForMovieIds` below is what resolves
 * it; this function only ever sees values.
 */
export function scoreMovies(input: ScoringInput): Map<number, number> {
  const totals = new Map<number, number>();

  for (const nomination of input.nominations) {
    const value = input.pointsByAward.get(nomination.awardId);
    // An award whose points row is missing scores nothing rather than NaN.
    // One unresolvable row must not poison an entire team's total, and a
    // silent zero is easier to spot than a total that reads "NaN".
    if (value == null) continue;

    const won =
      input.winnersByAward.get(nomination.awardId)?.has(nomination.movieId) === true;

    totals.set(
      nomination.movieId,
      (totals.get(nomination.movieId) ?? 0) + value + (won ? value : 0),
    );
  }

  return totals;
}

/** Sum a set of movie totals — a team, a league seat, a shortlist. */
export function sumTotals(
  totals: ReadonlyMap<number, number>,
  movieIds: readonly number[],
): number {
  return movieIds.reduce((sum, id) => sum + (totals.get(id) ?? 0), 0);
}

/**
 * Load everything the rule needs for these movies, then apply it.
 *
 * Every lookup is batched by id. The source dashboard queried per movie inside
 * a loop, which is invisible with three films and painful with a full league.
 *
 * 🔴 A win is a `winners` row whose award **and** movie both match. The source
 * app declared `Awards.hasOne(Movies, { foreignKey: 'id' })`, which joins
 * `movies.id = winners.id` and nests an unrelated movie — that bug is recorded
 * in PROGRESS and must not be ported.
 */
export async function pointsForMovieIds(
  movieIds: readonly number[],
  year: number,
): Promise<Map<number, number>> {
  if (movieIds.length === 0) return new Map();

  const nominations = await nominationRepository.findManyByMovieIds(movieIds);

  // `nominations.year` is TEXT while `winners.year` is INTEGER — a genuine
  // inconsistency in the restored schema, not a modelling choice. Comparing
  // the text column against a number silently matches nothing, so both sides
  // are normalized to a number here. A row whose year is null or unparseable
  // is dropped: it cannot be attributed to a season, and guessing would score
  // a film in the wrong one.
  const forYear = nominations.filter((nomination) => Number(nomination.year) === year);
  if (forYear.length === 0) return new Map();

  const awardIds = [...new Set(forYear.map((nomination) => nomination.awardId))];
  const [awards, winners] = await Promise.all([
    awardRepository.findManyByIds(awardIds),
    winnerRepository.findManyByAwardIds(awardIds),
  ]);

  // awards.points is the foreign key; this is where it becomes a value.
  const pointsIds = [
    ...new Set(
      awards.flatMap((award) => (award.pointsId == null ? [] : [award.pointsId])),
    ),
  ];
  const pointRows = await pointRepository.findManyByIds(pointsIds);
  const valueByPointsId = new Map(pointRows.map((row) => [row.id, row.points ?? 0]));

  const pointsByAward = new Map<number, number>();
  for (const award of awards) {
    if (award.pointsId == null) continue;
    const value = valueByPointsId.get(award.pointsId);
    if (value != null) pointsByAward.set(award.id, value);
  }

  const winnersByAward = new Map<number, Set<number>>();
  for (const winner of winners) {
    if (winner.year !== year) continue;
    const existing = winnersByAward.get(winner.awardId);
    if (existing) existing.add(winner.movieId);
    else winnersByAward.set(winner.awardId, new Set([winner.movieId]));
  }

  return scoreMovies({ nominations: forYear, pointsByAward, winnersByAward });
}
