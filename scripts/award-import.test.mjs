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

  // 🔴 Pins the majority threshold itself. Exactly half outside is not a
  // majority, so it passes — and this is the case that fails if the
  // comparison ever drifts (outside * 3 <= known, say, would refuse here).
  it('passes when exactly half the nominated films fall outside the range', () => {
    expect(
      yearCheck({
        nominatedYears: [2025, 2025, 2019, 2019],
        seasonYears: [2025],
      }).ok,
    ).toBe(true);
  });
});

import { applyNominations, movieInsertColumns, resolveFilm } from './award-import.mjs';

/** A pg-shaped stub: hand it queries to match, collect what was run. */
function fakeClient(handlers) {
  const ran = [];
  return {
    ran,
    async query(text, params) {
      ran.push({ text, params });
      for (const [pattern, rows] of handlers) {
        if (pattern.test(text))
          return { rows: typeof rows === 'function' ? rows(params) : rows };
      }
      return { rows: [] };
    },
  };
}

describe('movieInsertColumns', () => {
  // 🔴 Pinned against movieRepository.upsertByTmdbId in lib/repositories/movies.ts.
  // The script cannot import that file (TypeScript behind @/ aliases), so this
  // test is the only thing standing between the two copies and silent drift.
  it('writes exactly the columns the repository writes', () => {
    expect(movieInsertColumns()).toEqual([
      'tmdb_id',
      'imdb_id',
      'title',
      'sort_title',
      'poster',
      'backdrop',
      'release_date',
      'created_at',
      'updated_at',
    ]);
  });
});

describe('resolveFilm', () => {
  it('returns the cached row without asking TMDB', async () => {
    const client = fakeClient([
      [
        /FROM movies WHERE tmdb_id/,
        [{ id: 42, title: 'Sinners', release_date: new Date('2025-04-18') }],
      ],
    ]);
    const fetchFilm = () => {
      throw new Error('TMDB must not be called for a cached film');
    };
    const result = await resolveFilm(
      client,
      { title: 'Sinners', tmdbId: '1233413' },
      fetchFilm,
    );
    expect(result).toEqual({
      movieId: 42,
      title: 'Sinners',
      releaseYear: 2025,
      created: false,
    });
  });

  it('ingests an unknown film and reports it as created', async () => {
    const client = fakeClient([
      [/FROM movies WHERE tmdb_id/, []],
      [
        /INSERT INTO movies/,
        [
          {
            id: 99,
            title: 'One Battle After Another',
            release_date: new Date('2025-09-26'),
          },
        ],
      ],
    ]);
    const fetchFilm = async () => ({
      tmdbId: '1234567',
      imdbId: '1234567',
      title: 'One Battle After Another',
      sortTitle: 'One Battle After Another',
      poster: '/p.jpg',
      backdrop: null,
      releaseDate: new Date('2025-09-26'),
    });
    const result = await resolveFilm(
      client,
      { title: 'One Battle After Another', tmdbId: '1234567' },
      fetchFilm,
    );
    expect(result.movieId).toBe(99);
    expect(result.created).toBe(true);
  });

  it('throws rather than writing a half-film when TMDB has nothing', async () => {
    const client = fakeClient([[/FROM movies WHERE tmdb_id/, []]]);
    await expect(
      resolveFilm(client, { title: 'Ghost', tmdbId: '0' }, async () => null),
    ).rejects.toThrow(/Ghost/);
  });
});

describe('applyNominations', () => {
  const context = {
    event: {
      id: 7,
      name: 'DGA',
      abbreviation: 'DGA',
      nomActive: true,
      awardsActive: false,
    },
    awards: [{ id: 11, name: 'Best Picture', requiresNomineeName: false, points: 5 }],
    activeYear: 2025,
    existingNominations: [],
    seasonYears: [2025],
  };
  const plan = {
    kind: 'nominations',
    eventAbbreviation: 'DGA',
    eventId: 7,
    year: 2025,
    sources: ['https://example.com'],
    categories: [
      {
        awardId: 11,
        awardName: 'Best Picture',
        nominees: [{ title: 'Sinners', tmdbId: '1233413' }],
      },
    ],
  };

  const cached = [
    [
      /FROM movies WHERE tmdb_id/,
      [{ id: 42, title: 'Sinners', release_date: new Date('2025-04-18') }],
    ],
  ];

  it('writes nothing without --commit', async () => {
    const client = fakeClient(cached);
    const report = await applyNominations(client, plan, context, { commit: false });
    expect(report.inserted).toHaveLength(1);
    expect(client.ran.some((call) => /INSERT INTO nominations/.test(call.text))).toBe(
      false,
    );
  });

  it('inserts inside a transaction when committing', async () => {
    const client = fakeClient(cached);
    await applyNominations(client, plan, context, { commit: true });
    const texts = client.ran.map((call) => call.text);
    expect(texts).toContain('BEGIN');
    expect(texts).toContain('COMMIT');
    expect(texts.some((text) => /INSERT INTO nominations/.test(text))).toBe(true);
  });

  // 🔴 A double-run would double that film's points for the category.
  it('skips a nomination that already exists', async () => {
    const client = fakeClient(cached);
    const report = await applyNominations(
      client,
      plan,
      {
        ...context,
        existingNominations: [{ awardId: 11, movieId: 42, title: 'Sinners' }],
      },
      { commit: true },
    );
    expect(report.inserted).toHaveLength(0);
    expect(report.skipped[0].reason).toMatch(/already nominated/);
  });

  it('refuses the whole run when the plan is invalid', async () => {
    const client = fakeClient(cached);
    await expect(
      applyNominations(client, { ...plan, sources: [] }, context, { commit: true }),
    ).rejects.toThrow(/source URL/);
    expect(client.ran.some((call) => /INSERT/.test(call.text))).toBe(false);
  });

  // The listing was a year off — the failure this whole pipeline exists to catch.
  it('refuses the whole run when the year check fails', async () => {
    const client = fakeClient([
      [
        /FROM movies WHERE tmdb_id/,
        [{ id: 42, title: 'Sinners', release_date: new Date('2022-04-18') }],
      ],
    ]);
    await expect(
      applyNominations(
        client,
        plan,
        { ...context, seasonYears: [2025, 2026] },
        { commit: true },
      ),
    ).rejects.toThrow(/outside/);
    expect(client.ran.some((call) => /INSERT INTO nominations/.test(call.text))).toBe(
      false,
    );
  });
});

import { applyWinners } from './award-import.mjs';

describe('applyWinners', () => {
  const context = {
    event: {
      id: 7,
      name: 'DGA',
      abbreviation: 'DGA',
      nomActive: false,
      awardsActive: true,
    },
    awards: [{ id: 11, name: 'Best Picture', requiresNomineeName: false, points: 5 }],
    activeYear: 2025,
    existingNominations: [{ awardId: 11, movieId: 42, title: 'Sinners' }],
    seasonYears: [2025],
  };
  const plan = {
    kind: 'winners',
    eventAbbreviation: 'DGA',
    eventId: 7,
    year: 2025,
    sources: ['https://example.com'],
    categories: [
      {
        awardId: 11,
        awardName: 'Best Picture',
        nominees: [{ title: 'Sinners', tmdbId: '1233413' }],
      },
    ],
  };
  const handlers = [
    [
      /FROM movies WHERE tmdb_id/,
      [{ id: 42, title: 'Sinners', release_date: new Date('2025-04-18') }],
    ],
    [/FROM nominations/, [{ id: 500 }]],
  ];

  // 🔴 A win pays the award's points a second time, so a winner that was never
  // nominated scores for a nomination that does not exist — the film would hold
  // points no page could explain. Same refusal as setWinner.
  it('refuses a winner that is not nominated in that category', async () => {
    const client = fakeClient([handlers[0], [/FROM nominations/, []]]);
    await expect(applyWinners(client, plan, context, { commit: true })).rejects.toThrow(
      /not nominated/,
    );
    expect(client.ran.some((call) => /INSERT INTO winners/.test(call.text))).toBe(false);
  });

  // One category has one winner. Two rows would pay the points twice.
  it('deletes the category existing winner before inserting', async () => {
    const client = fakeClient(handlers);
    await applyWinners(client, plan, context, { commit: true });
    const texts = client.ran.map((call) => call.text);
    const deleteAt = texts.findIndex((text) => /DELETE FROM winners/.test(text));
    const insertAt = texts.findIndex((text) => /INSERT INTO winners/.test(text));
    expect(deleteAt).toBeGreaterThanOrEqual(0);
    expect(insertAt).toBeGreaterThan(deleteAt);
  });

  it('writes nothing without --commit', async () => {
    const client = fakeClient(handlers);
    const report = await applyWinners(client, plan, context, { commit: false });
    expect(report.set).toHaveLength(1);
    expect(client.ran.some((call) => /INSERT INTO winners/.test(call.text))).toBe(false);
  });
});

import { finishShow, refresh } from './award-import.mjs';

describe('finishShow', () => {
  const context = {
    event: {
      id: 7,
      name: 'DGA',
      abbreviation: 'dga',
      nomActive: true,
      awardsActive: false,
    },
    awards: [],
    activeYear: 2025,
    existingNominations: [],
    seasonYears: [],
  };

  it('refuses an empty message rather than broadcasting a blank', async () => {
    const client = fakeClient([]);
    await expect(
      finishShow(client, context, { message: '   ', kind: 'nominations', commit: true }),
    ).rejects.toThrow(/message/);
    expect(client.ran).toHaveLength(0);
  });

  it('counts recipients without writing when not committing', async () => {
    const client = fakeClient([[/FROM users/, [{ count: '61' }]]]);
    const result = await finishShow(client, context, {
      message: 'DGA nominations are in.',
      kind: 'nominations',
      commit: false,
    });
    expect(result.recipients).toBe(61);
    expect(client.ran.some((call) => /INSERT INTO notifications/.test(call.text))).toBe(
      false,
    );
  });

  // nom_active = true means "needs nominations" — finishing turns it off.
  it('clears nom_active and links the notification at the show', async () => {
    const client = fakeClient([[/FROM users/, [{ count: '2' }]]]);
    await finishShow(client, context, {
      message: 'DGA nominations are in.',
      kind: 'nominations',
      commit: true,
    });
    const update = client.ran.find((call) => /UPDATE events/.test(call.text));
    expect(update.text).toMatch(/nom_active = false/);
    const insert = client.ran.find((call) => /INSERT INTO notifications/.test(call.text));
    expect(insert.params).toContain('/award-shows/dga');
  });

  it('clears awards_active for a winners run', async () => {
    const client = fakeClient([[/FROM users/, [{ count: '2' }]]]);
    await finishShow(
      client,
      { ...context, event: { ...context.event, awardsActive: true } },
      {
        message: 'The DGA winners are in.',
        kind: 'winners',
        commit: true,
      },
    );
    expect(client.ran.find((call) => /UPDATE events/.test(call.text)).text).toMatch(
      /awards_active = false/,
    );
  });
});

describe('refresh', () => {
  it('posts the secret, then confirms the titles render', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/api/revalidate')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { revalidated: ['/award-shows/dga'] };
          },
        };
      }
      return {
        ok: true,
        status: 200,
        async text() {
          return '<h2>Sinners</h2>';
        },
      };
    };

    const result = await refresh({
      abbreviation: 'dga',
      year: 2025,
      titles: ['Sinners'],
      baseUrl: 'https://cinemadraft.com',
      secret: 's3cret',
      fetchImpl,
    });

    expect(JSON.parse(calls[0].init.body).secret).toBe('s3cret');
    expect(calls[1].url).toBe('https://cinemadraft.com/award-shows/dga?year=2025');
    expect(result.missing).toEqual([]);
  });

  // 🔴 The check that makes the revalidation honest. A 200 from the endpoint
  // proves nothing about what the reader sees.
  it('reports a title that does not appear on the live page', async () => {
    const fetchImpl = async (url) =>
      String(url).endsWith('/api/revalidate')
        ? {
            ok: true,
            status: 200,
            async json() {
              return { revalidated: [] };
            },
          }
        : {
            ok: true,
            status: 200,
            async text() {
              return '<h2>Something else</h2>';
            },
          };

    const result = await refresh({
      abbreviation: 'dga',
      year: 2025,
      titles: ['Sinners'],
      baseUrl: 'https://cinemadraft.com',
      secret: 's3cret',
      fetchImpl,
    });
    expect(result.missing).toEqual(['Sinners']);
  });

  it('throws rather than silently skipping the clear when no secret is set', async () => {
    await expect(
      refresh({
        abbreviation: 'dga',
        year: 2025,
        titles: [],
        baseUrl: 'https://cinemadraft.com',
        secret: null,
        fetchImpl: async () => ({ ok: true }),
      }),
    ).rejects.toThrow(/REVALIDATE_SECRET/);
  });
});
