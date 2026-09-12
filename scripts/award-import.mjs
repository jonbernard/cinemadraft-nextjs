#!/usr/bin/env node
// Enter a show's nominations or winners, then clear the cache and notify.
//
//   DATABASE_URL=… TMDB_API_KEY=… node scripts/award-import.mjs <command> [args]
//
// Commands: context | apply | finish | refresh. Nothing writes without --commit.
//
// 🔴 This script bypasses the Clerk-gated server actions, so every invariant
// they enforce is enforced here instead — see
// docs/superpowers/specs/2026-09-12-award-entry-pipeline-design.md.
//
// 🔴 It never loads a .env file. Reaching production stays a conscious act,
// which is the same rule the header of .env states.

/** Category headings vary by publication; the `awards` row is the authority. */
export function normalizeCategory(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * A listing heading → the award row it names, or null.
 *
 * 🔴 Null rather than a nearest match, deliberately. A nomination filed under
 * the wrong category pays that category's points to the film, and the page
 * renders it without a hint that anything is wrong. An unmatched heading is
 * reported to the owner instead, who can add the category or skip it.
 */
export function matchCategory(heading, awards) {
  const wanted = normalizeCategory(heading);
  return awards.find((award) => normalizeCategory(award.name) === wanted) ?? null;
}

/** Every problem with a plan, as sentences. Empty means it may be applied. */
export function validatePlan(plan, awards) {
  const problems = [];
  const byId = new Map(awards.map((award) => [award.id, award]));

  if (plan.kind !== 'nominations' && plan.kind !== 'winners') {
    problems.push('kind must be "nominations" or "winners"');
  }
  if (!Number.isSafeInteger(plan.year) || plan.year <= 0) {
    problems.push('year must be a positive integer');
  }
  if (!Array.isArray(plan.sources) || plan.sources.length === 0) {
    problems.push('the plan records no source URL');
  }

  for (const category of plan.categories ?? []) {
    const award = byId.get(category.awardId);
    if (!award) {
      problems.push(`award ${category.awardId} does not belong to this event`);
      continue;
    }
    for (const nominee of category.nominees ?? []) {
      if (award.requiresNomineeName && !nominee.detailName) {
        problems.push(
          `award ${award.id} requires a nominee name: "${nominee.title}" has none`,
        );
      }
      if (!nominee.title) problems.push(`award ${award.id} has a nominee with no title`);
    }
  }

  return problems;
}

/**
 * Is this listing for the season being written?
 *
 * 🔴 The failure this exists for: "Oscars 2026" means the 2025 season, and the
 * reverse holds for other shows. Getting it backwards writes a full, plausible,
 * entirely wrong season of nominations that scores real points for real teams.
 *
 * The test is empirical rather than semantic — compare the release years of the
 * films just resolved against the release years of the films drafted in this
 * season. A season honours the previous year's films (D57), so the accepted
 * range is the span of the picks, widened by one year at each end.
 */
export function yearCheck({ nominatedYears, seasonYears }) {
  const known = nominatedYears.filter((year) => Number.isSafeInteger(year));
  if (known.length === 0 || seasonYears.length === 0) {
    return { ok: true, reason: null };
  }

  const low = Math.min(...seasonYears) - 1;
  const high = Math.max(...seasonYears) + 1;
  const outside = known.filter((year) => year < low || year > high);

  if (outside.length * 2 <= known.length) return { ok: true, reason: null };

  const counts = new Map();
  for (const year of known) counts.set(year, (counts.get(year) ?? 0) + 1);
  const shape = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, count]) => `${year}×${count}`)
    .join(', ');

  return {
    ok: false,
    reason:
      `${outside.length} of ${known.length} nominated films fall outside ` +
      `${low}–${high}, the range this season's draft picks sit in. ` +
      `Nominated: ${shape}. This is usually the wrong year's listing.`,
  };
}
