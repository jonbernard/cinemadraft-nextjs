import { describe, expect, it } from 'vitest';

import {
  matchCategory,
  normalizeCategory,
  validatePlan,
  yearCheck,
} from './award-import.mjs';

const AWARDS = [
  {
    id: 10,
    name: 'Outstanding Directorial Achievement in Theatrical Feature Film',
    requiresNomineeName: true,
  },
  { id: 11, name: 'Best Picture', requiresNomineeName: false },
];

describe('matchCategory', () => {
  it('matches an exact heading', () => {
    expect(matchCategory('Best Picture', AWARDS)?.id).toBe(11);
  });

  // Listings vary in punctuation and case; the award row is the authority.
  it('matches ignoring case, punctuation and stray whitespace', () => {
    expect(matchCategory('  best   picture:', AWARDS)?.id).toBe(11);
  });

  // 🔴 The failure that matters: a near-miss heading must NOT be guessed into
  // a real category, because a wrong category pays the wrong points to the
  // wrong film and nothing on the page would look odd.
  it('returns null rather than guessing at an unknown heading', () => {
    expect(matchCategory('Best Documentary Feature', AWARDS)).toBe(null);
  });
});

describe('normalizeCategory', () => {
  it('strips punctuation, collapses whitespace and lowercases', () => {
    expect(normalizeCategory('  Best   PICTURE: ')).toBe('best picture');
  });
});

describe('validatePlan', () => {
  const plan = {
    kind: 'nominations',
    eventAbbreviation: 'DGA',
    eventId: 7,
    year: 2025,
    sources: ['https://example.com/listing'],
    categories: [
      {
        awardId: 11,
        awardName: 'Best Picture',
        nominees: [{ title: 'One Battle After Another', tmdbId: '1234567' }],
      },
    ],
  };

  it('accepts a well-formed plan', () => {
    expect(validatePlan(plan, AWARDS)).toEqual([]);
  });

  // A person category with no name renders a category listing four films and
  // a blank, which reads as a data-entry mistake nobody made.
  it('rejects a person category whose nominee has no detailName', () => {
    const bad = {
      ...plan,
      categories: [
        { awardId: 10, awardName: 'Directing', nominees: [{ title: 'X', tmdbId: '1' }] },
      ],
    };
    expect(validatePlan(bad, AWARDS)).toContain(
      'award 10 requires a nominee name: "X" has none',
    );
  });

  it('rejects an awardId that does not belong to this event', () => {
    const bad = {
      ...plan,
      categories: [{ awardId: 99, awardName: 'Nope', nominees: [] }],
    };
    expect(validatePlan(bad, AWARDS)).toContain('award 99 does not belong to this event');
  });

  it('rejects a plan with no sources recorded', () => {
    expect(validatePlan({ ...plan, sources: [] }, AWARDS)).toContain(
      'the plan records no source URL',
    );
  });

  it('rejects an unknown kind', () => {
    expect(validatePlan({ ...plan, kind: 'guesses' }, AWARDS)).toContain(
      'kind must be "nominations" or "winners"',
    );
  });
});

describe('yearCheck', () => {
  // The season honours the previous year's films (D57): 507 of the 2026
  // season's 526 nominations are 2025 releases.
  it('passes when the nominated films sit in the season the picks sit in', () => {
    expect(
      yearCheck({
        nominatedYears: [2025, 2025, 2025, 2026, 2025],
        seasonYears: [2025, 2025, 2024, 2025, 2026],
      }).ok,
    ).toBe(true);
  });

  // 🔴 The one failure that produces a full, plausible, entirely wrong season.
  it('refuses when most nominated films fall outside the season range', () => {
    const result = yearCheck({
      nominatedYears: [2023, 2023, 2023, 2024],
      seasonYears: [2025, 2025, 2026],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/2023/);
  });

  // A season whose draft has not happened yet has no picks to compare against.
  // Refusing there would block the first show of every season.
  it('passes when the season has no picks to compare against', () => {
    expect(yearCheck({ nominatedYears: [2025, 2025], seasonYears: [] }).ok).toBe(true);
  });

  it('passes when nothing was nominated', () => {
    expect(yearCheck({ nominatedYears: [], seasonYears: [2025] }).ok).toBe(true);
  });
});
