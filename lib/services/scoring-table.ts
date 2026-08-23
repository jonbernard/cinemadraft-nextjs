import type { Point } from '@/lib/repositories/points';

export type ScoringLevel = {
  level: string;
  /** Ascending by tier — the repository's own order, carried through unchanged. */
  tiers: { tier: number; points: number }[];
};

/**
 * Shapes the scoring rulebook for display (T47): grouped by `level`, then by
 * `tier`, with levels ordered by descending point value.
 *
 * `pointRepository.findAll()`'s doc comment is explicit that this grouping and
 * ordering are decisions about how the settings screen renders, not something
 * the repository should bake in — so they live here, next to the page that
 * needs them, rather than changing the repository's own `level asc, tier asc`
 * order.
 *
 * "Descending point value" is per level's own highest tier, since that is the
 * value a reader would call "what this level is worth" — the source grouped
 * *every* row across all levels by value before regrouping by level, which
 * only matters when two different levels' rows tie exactly, and produces the
 * same reading order in every case that isn't a tie.
 *
 * `level` and `tier` are nullable columns in the schema (every real row has
 * both, but nothing enforces it), so a row missing either is dropped rather
 * than grouped under a manufactured key — a scoring row too broken to place
 * on the table is not the same as a row worth zero.
 */
export function groupPointsByLevel(points: readonly Point[]): ScoringLevel[] {
  const byLevel = new Map<string, { tier: number; points: number }[]>();

  for (const point of points) {
    if (point.level == null || point.tier == null) continue;
    const entry = { tier: point.tier, points: point.points ?? 0 };
    const tiers = byLevel.get(point.level);
    if (tiers) tiers.push(entry);
    else byLevel.set(point.level, [entry]);
  }

  return [...byLevel.entries()]
    .map(([level, tiers]) => ({
      level,
      tiers: [...tiers].sort((a, b) => a.tier - b.tier),
    }))
    .sort(
      (a, b) =>
        Math.max(...b.tiers.map((t) => t.points)) -
        Math.max(...a.tiers.map((t) => t.points)),
    );
}
