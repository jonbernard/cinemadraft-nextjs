import { describe, expect, it } from 'vitest';

import { validatePlan, yearCheck } from './award-import.mjs';

const AWARDS = [
  {
    id: 10,
    name: 'Outstanding Directorial Achievement in Theatrical Feature Film',
    requiresNomineeName: true,
  },
  { id: 11, name: 'Best Picture', requiresNomineeName: false },
];

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

  // M4: in winners mode the second DELETE removes the first INSERT, so one
  // category would silently win over the other rather than both applying.
  it('rejects a plan naming the same awardId twice', () => {
    const bad = {
      ...plan,
      categories: [
        ...plan.categories,
        {
          awardId: 11,
          awardName: 'Best Picture',
          nominees: [{ title: 'Sinners', tmdbId: '1233413' }],
        },
      ],
    };
    expect(validatePlan(bad, AWARDS)).toContain('award 11 appears twice in this plan');
  });

  // M5: a whitespace-only detailName passes a truthiness check but fails
  // attach-nominee.ts's `z.string().trim().min(1)`, and renders as a blank.
  it('rejects a whitespace-only detailName', () => {
    const bad = {
      ...plan,
      categories: [
        {
          awardId: 10,
          awardName: 'Directing',
          nominees: [{ title: 'X', tmdbId: '1', detailName: '   ' }],
        },
      ],
    };
    expect(validatePlan(bad, AWARDS)).toContain(
      'award 10 requires a nominee name: "X" has none',
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

import {
  applyNominations,
  fetchTmdbFilm,
  movieInsertColumns,
  resolveFilm,
} from './award-import.mjs';

describe('fetchTmdbFilm', () => {
  // I4: mirrors `releaseDateOf` in lib/external/tmdb.ts — for awards films
  // the top-level date and the US theatrical date differ by a year routinely
  // (a festival premiere abroad against a January US release), and that
  // release year feeds straight into the year check.
  it('prefers the US release date over the top-level release_date', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.TMDB_API_KEY;
    process.env.TMDB_API_KEY = 'test-key';
    globalThis.fetch = async () => ({
      ok: true,
      async json() {
        return {
          id: 1234567,
          title: 'One Battle After Another',
          release_date: '2024-09-26',
          release_dates: {
            results: [
              {
                iso_3166_1: 'US',
                release_dates: [{ release_date: '2025-01-10' }],
              },
            ],
          },
        };
      },
    });
    try {
      const result = await fetchTmdbFilm('1234567');
      expect(result.releaseDate.getFullYear()).toBe(2025);
    } finally {
      globalThis.fetch = originalFetch;
      process.env.TMDB_API_KEY = originalKey;
    }
  });
});

/** A pg-shaped stub: hand it queries to match, collect what was run. */
function fakeClient(handlers) {
  const ran = [];
  return {
    ran,
    async query(text, params) {
      ran.push({ text, params });
      for (const [pattern, rows] of handlers) {
        if (pattern.test(text))
          return { rows: typeof rows === 'function' ? rows(params, text) : rows };
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

  // I2: every subcommand is read-only without --commit, including for a film
  // TMDB has never been asked about.
  it('does not insert or call TMDB for an uncached film on a dry run', async () => {
    const client = fakeClient([[/FROM movies WHERE tmdb_id/, []]]);
    const fetchFilm = () => {
      throw new Error('TMDB must not be called on a dry run');
    };
    const result = await resolveFilm(
      client,
      { title: 'Ghost', tmdbId: '0' },
      fetchFilm,
      false,
    );
    expect(result).toEqual({
      movieId: null,
      title: 'Ghost',
      releaseYear: null,
      created: true,
    });
    expect(client.ran.some((call) => /INSERT INTO movies/.test(call.text))).toBe(false);
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

  // C1: a plan naming a different season than available_years's active one
  // must never write — a correct listing for the wrong year passes every
  // other check and would double every film's points on a second run.
  it('refuses when the plan year is not the active season, and writes nothing', async () => {
    const client = fakeClient(cached);
    await expect(
      applyNominations(client, { ...plan, year: 2026 }, context, { commit: true }),
    ).rejects.toThrow(/not the active season/);
    expect(client.ran.some((call) => /INSERT/.test(call.text))).toBe(false);
  });

  // I5: before a season's drafts there are no picks to measure against, and
  // that is exactly when the wrong-year listing is easiest to reach for.
  it('refuses a wrong-year listing even when the season has no picks yet', async () => {
    const client = fakeClient([
      [
        /FROM movies WHERE tmdb_id/,
        [{ id: 42, title: 'Sinners', release_date: new Date('2019-04-18') }],
      ],
    ]);
    await expect(
      applyNominations(client, plan, { ...context, seasonYears: [] }, { commit: true }),
    ).rejects.toThrow(/outside/);
    expect(client.ran.some((call) => /INSERT INTO nominations/.test(call.text))).toBe(
      false,
    );
  });

  // I2: a dry run must never write to `movies`, even for a film not yet cached.
  it('does not insert into movies for an uncached film on a dry run', async () => {
    const client = fakeClient([[/FROM movies WHERE tmdb_id/, []]]);
    const report = await applyNominations(client, plan, context, { commit: false });
    expect(report.inserted).toHaveLength(1);
    expect(client.ran.some((call) => /INSERT INTO movies/.test(call.text))).toBe(false);
  });

  // 🔴 A dry run with two different uncached nominees in the same category
  // must report both as inserted and neither as skipped. Without the tmdbId
  // fallback, both get movieId: null and produce the identical dedupe key,
  // causing the second (and any further) to be silently reported as skipped
  // despite never being processed before — hiding real nominees from approval.
  it('reports two different uncached nominees in the same category as inserted', async () => {
    const client = fakeClient([[/FROM movies WHERE tmdb_id/, []]]);
    const twoNomineePlan = {
      ...plan,
      categories: [
        {
          awardId: 11,
          awardName: 'Best Picture',
          nominees: [
            { title: 'Film A', tmdbId: '1111111' },
            { title: 'Film B', tmdbId: '2222222' },
          ],
        },
      ],
    };
    const report = await applyNominations(client, twoNomineePlan, context, {
      commit: false,
    });
    expect(report.inserted).toHaveLength(2);
    expect(report.skipped).toHaveLength(0);
  });

  // 2026 Best Supporting Actor: one film, two nominees. The duplicate rule is
  // film AND person, never film alone.
  describe('the same film twice in one category', () => {
    const personContext = {
      ...context,
      awards: [
        { id: 12, name: 'Supporting Actor', requiresNomineeName: true, points: 3 },
      ],
    };
    const obaa = [
      [
        /FROM movies WHERE tmdb_id/,
        [
          {
            id: 77,
            title: 'One Battle After Another',
            release_date: new Date('2025-09-26'),
          },
        ],
      ],
    ];
    const pairPlan = (names) => ({
      ...plan,
      categories: [
        {
          awardId: 12,
          awardName: 'Supporting Actor',
          nominees: names.map((detailName) => ({
            title: 'One Battle After Another',
            tmdbId: '1054867',
            detailName,
          })),
        },
      ],
    });

    it('accepts the same film for a different person', async () => {
      const client = fakeClient(obaa);
      const report = await applyNominations(
        client,
        pairPlan(['Benicio del Toro', 'Sean Penn']),
        personContext,
        { commit: true },
      );
      expect(report.inserted.map((row) => row.detailName)).toEqual([
        'Benicio del Toro',
        'Sean Penn',
      ]);
      const inserts = client.ran.filter((call) =>
        /INSERT INTO nominations/.test(call.text),
      );
      expect(inserts.map((call) => call.params[3])).toEqual([
        'Benicio del Toro',
        'Sean Penn',
      ]);
    });

    it('accepts a second person when the first is already in the database', async () => {
      const client = fakeClient(obaa);
      const report = await applyNominations(
        client,
        pairPlan(['Sean Penn']),
        {
          ...personContext,
          existingNominations: [
            {
              awardId: 12,
              movieId: 77,
              title: 'One Battle After Another',
              detailName: 'Benicio del Toro',
              detailId: null,
            },
          ],
        },
        { commit: true },
      );
      expect(report.inserted.map((row) => row.detailName)).toEqual(['Sean Penn']);
    });

    it('refuses the same film and the same person, case-folded and trimmed', async () => {
      const client = fakeClient(obaa);
      const report = await applyNominations(
        client,
        pairPlan(['Sean Penn', '  sean PENN ']),
        {
          ...personContext,
          existingNominations: [
            {
              awardId: 12,
              movieId: 77,
              title: 'One Battle After Another',
              detailName: 'SEAN PENN',
              detailId: null,
            },
          ],
        },
        { commit: true },
      );
      expect(report.inserted).toHaveLength(0);
      expect(report.skipped).toHaveLength(2);
    });

    it('matches on detail_id when both sides carry one', async () => {
      const client = fakeClient(obaa);
      const report = await applyNominations(
        client,
        {
          ...plan,
          categories: [
            {
              awardId: 12,
              awardName: 'Supporting Actor',
              nominees: [
                {
                  title: 'One Battle After Another',
                  tmdbId: '1054867',
                  detailName: 'Sean Penn (credited)',
                  detailId: 2228,
                },
              ],
            },
          ],
        },
        {
          ...personContext,
          existingNominations: [
            {
              awardId: 12,
              movieId: 77,
              title: 'One Battle After Another',
              detailName: 'Sean Penn',
              detailId: 2228,
            },
          ],
        },
        { commit: true },
      );
      expect(report.inserted).toHaveLength(0);
    });
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

  // C1: the nomination lookup already filters on plan.year, so this refuses
  // in practice — but the guard must agree with applyNominations regardless.
  it('refuses when the plan year is not the active season, and writes nothing', async () => {
    const client = fakeClient(handlers);
    await expect(
      applyWinners(client, { ...plan, year: 2026 }, context, { commit: true }),
    ).rejects.toThrow(/not the active season/);
    expect(client.ran.some((call) => /INSERT|DELETE/.test(call.text))).toBe(false);
  });

  // I2: a dry run must never write to `movies`, even for a film not yet
  // cached — and it must not throw a false "not nominated" for a film it
  // never actually looked up.
  it('does not insert into movies for an uncached film on a dry run', async () => {
    const client = fakeClient([[/FROM movies WHERE tmdb_id/, []]]);
    const report = await applyWinners(client, plan, context, { commit: false });
    expect(report.unverifiable).toHaveLength(1);
    expect(report.set).toHaveLength(0);
    expect(client.ran.some((call) => /INSERT INTO movies/.test(call.text))).toBe(false);
  });

  // 🔴 2026 Best Supporting Actor: One Battle After Another holds two
  // nominations. The app scores the winner by winners.nomination_id, so the
  // wrong id crowns the wrong person.
  describe('a film with two nominations in the category', () => {
    const personContext = {
      ...context,
      awards: [
        { id: 12, name: 'Supporting Actor', requiresNomineeName: true, points: 3 },
      ],
    };
    const pair = [
      [
        /FROM movies WHERE tmdb_id/,
        [
          {
            id: 77,
            title: 'One Battle After Another',
            release_date: new Date('2025-09-26'),
          },
        ],
      ],
      [
        /FROM nominations/,
        // Honours LIMIT, so a lookup that asks for one row gets one — as pg would.
        (_, text) => {
          const both = [
            { id: 901, detail_name: 'Benicio del Toro', detail_id: null },
            { id: 902, detail_name: 'Sean Penn', detail_id: null },
          ];
          return /LIMIT 1/.test(text) ? both.slice(0, 1) : both;
        },
      ],
    ];
    const winnerPlan = (nominee) => ({
      ...plan,
      categories: [
        {
          awardId: 12,
          awardName: 'Supporting Actor',
          nominees: [
            { title: 'One Battle After Another', tmdbId: '1054867', ...nominee },
          ],
        },
      ],
    });

    it("records the named person's nomination", async () => {
      const client = fakeClient(pair);
      await applyWinners(
        client,
        winnerPlan({ detailName: ' sean penn ' }),
        personContext,
        { commit: true },
      );
      const insert = client.ran.find((call) => /INSERT INTO winners/.test(call.text));
      expect(insert.params[2]).toBe(902);
    });

    it('refuses, naming the candidates, when the plan names no person', async () => {
      const client = fakeClient(pair);
      // Bypass validatePlan's person-category rule to reach the lookup itself.
      await expect(
        applyWinners(
          client,
          winnerPlan({}),
          {
            ...personContext,
            awards: [{ ...personContext.awards[0], requiresNomineeName: false }],
          },
          { commit: true },
        ),
      ).rejects.toThrow(/Benicio del Toro.*Sean Penn/);
      expect(client.ran.some((call) => /INSERT|DELETE/.test(call.text))).toBe(false);
    });

    it('refuses a named person who holds neither nomination', async () => {
      const client = fakeClient(pair);
      await expect(
        applyWinners(client, winnerPlan({ detailName: 'Jacob Elordi' }), personContext, {
          commit: true,
        }),
      ).rejects.toThrow(/not nominated/);
      expect(client.ran.some((call) => /INSERT|DELETE/.test(call.text))).toBe(false);
    });
  });

  it('records the only nomination when the film has one and no person is named', async () => {
    const client = fakeClient(handlers);
    await applyWinners(client, plan, context, { commit: true });
    const insert = client.ran.find((call) => /INSERT INTO winners/.test(call.text));
    expect(insert.params[2]).toBe(500);
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

import {
  formatEt,
  isInSeason,
  seasonWindow,
  toDateTimeSplit,
  toInstant,
  zoneOffsetMs,
} from './award-import.mjs';

const ET = 'America/New_York';

describe('zoneOffsetMs', () => {
  it('is -5h for New York in January', () => {
    expect(zoneOffsetMs(Date.parse('2026-01-15T12:00:00Z'), ET)).toBe(-5 * 3600000);
  });

  // 🔴 US daylight saving begins 8 March 2026. The Oscars are the 15th, so a
  // ceremony converted at -5 would be recorded an hour late.
  it('is -4h for New York in late March', () => {
    expect(zoneOffsetMs(Date.parse('2026-03-20T12:00:00Z'), ET)).toBe(-4 * 3600000);
  });
});

describe('toInstant', () => {
  it('converts a winter morning announcement', () => {
    expect(toInstant({ date: '2026-01-22', time: '08:00', tz: ET })).toBe(
      Date.parse('2026-01-22T13:00:00Z'),
    );
  });

  // The real Oscars ceremony, inside daylight saving.
  it('converts a spring evening ceremony', () => {
    expect(toInstant({ date: '2026-03-15', time: '21:30', tz: ET })).toBe(
      Date.parse('2026-03-16T01:30:00Z'),
    );
  });

  // 🔴 What the second pass is for. Daylight saving begins at 07:00Z on 8 March
  // 2026; 05:00 EDT that morning is 09:00Z, but the naive reading (05:00Z) still
  // sits on the EST side, so a single pass lands an hour late at 10:00Z. The
  // Oscars case above cannot catch this — both of its readings are past the
  // transition — which is why a single-pass mutation left the suite green.
  it('converts a time just after the daylight-saving transition', () => {
    expect(toInstant({ date: '2026-03-08', time: '05:00', tz: ET })).toBe(
      Date.parse('2026-03-08T09:00:00Z'),
    );
  });
});

describe('toDateTimeSplit', () => {
  // Matches the restored oscars row exactly: 1769040000000 + 46800000.
  it('splits a morning announcement into UTC midnight plus the offset', () => {
    expect(toDateTimeSplit({ date: '2026-01-22', time: '08:00', tz: ET })).toEqual({
      date: Date.parse('2026-01-22T00:00:00Z'),
      time: 13 * 3600000,
    });
  });

  // 🔴 The >24h case, and the reason the split exists: an 8pm ET ceremony is
  // 01:00Z the NEXT day, but it belongs on the 11th's calendar row. Matches the
  // restored gg row: 1768089600000 + 90000000.
  it('keeps an evening ceremony on its own calendar day, past 24 hours', () => {
    expect(toDateTimeSplit({ date: '2026-01-11', time: '20:00', tz: ET })).toEqual({
      date: Date.parse('2026-01-11T00:00:00Z'),
      time: 25 * 3600000,
    });
  });

  // Matches the restored oscars awards row: 1773532800000 + 91800000.
  it('handles a half-hour ceremony inside daylight saving', () => {
    expect(toDateTimeSplit({ date: '2026-03-15', time: '21:30', tz: ET })).toEqual({
      date: Date.parse('2026-03-15T00:00:00Z'),
      time: 25.5 * 3600000,
    });
  });

  it('rejects a malformed date rather than writing NaN', () => {
    expect(() =>
      toDateTimeSplit({ date: 'January 22nd', time: '08:00', tz: ET }),
    ).toThrow(/date/);
  });

  it('rejects a malformed time rather than writing NaN', () => {
    expect(() => toDateTimeSplit({ date: '2026-01-22', time: '8am', tz: ET })).toThrow(
      /time/,
    );
  });
});

// 🔴 Every one of the twelve restored rows, round-tripped. If the conversion
// drifts, these are what notice — they are real production values, not
// invented ones.
describe('the restored rows round-trip', () => {
  const ROWS = [
    ['afi noms', 1764806400000, 46800000, '2025-12-04', '08:00'],
    ['gg noms', 1765152000000, 46800000, '2025-12-08', '08:00'],
    ['gg show', 1768089600000, 90000000, '2026-01-11', '20:00'],
    ['oscars noms', 1769040000000, 46800000, '2026-01-22', '08:00'],
    ['oscars show', 1773532800000, 91800000, '2026-03-15', '21:30'],
    ['sag noms', 1767744000000, 54000000, '2026-01-07', '10:00'],
    ['sag show', 1772323200000, 90000000, '2026-03-01', '20:00'],
    ['wga noms', 1769472000000, 57600000, '2026-01-27', '11:00'],
    ['bafta show', 1771718400000, 90000000, '2026-02-22', '20:00'],
    ['dga show', 1770422400000, 90000000, '2026-02-07', '20:00'],
  ];

  for (const [label, date, time, localDate, localTime] of ROWS) {
    it(`${label} converts to the stored split`, () => {
      expect(toDateTimeSplit({ date: localDate, time: localTime, tz: ET })).toEqual({
        date,
        time,
      });
    });
  }
});

describe('seasonWindow / isInSeason', () => {
  it('runs 1 August of the prior year to 31 July', () => {
    const window = seasonWindow(2026);
    expect(new Date(window.start).toISOString()).toBe('2025-08-01T00:00:00.000Z');
    expect(new Date(window.end).toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });

  it('accepts the real dates of the 2026 season', () => {
    expect(isInSeason(1764806400000, 2026)).toBe(true); // AFI noms, Dec 2025
    expect(isInSeason(1773532800000, 2026)).toBe(true); // Oscars, Mar 2026
  });

  it('rejects the season either side', () => {
    expect(isInSeason(Date.parse('2025-07-31T00:00:00Z'), 2026)).toBe(false);
    expect(isInSeason(Date.parse('2026-08-01T00:00:00Z'), 2026)).toBe(false);
  });

  // A show that has never had a date must read as "not current", not crash.
  it('treats a null instant as not in season', () => {
    expect(isInSeason(null, 2026)).toBe(false);
  });
});

describe('formatEt', () => {
  it('renders an instant as a readable ET moment', () => {
    expect(formatEt(1773532800000 + 91800000)).toMatch(/Mar 15, 2026.*9:30/);
  });

  it('renders a null as an em dash rather than "Invalid Date"', () => {
    expect(formatEt(null)).toBe('—');
  });
});

import { applyDates, validateDatesPlan } from './award-import.mjs';

const SHOWS = [
  {
    id: 7,
    abbreviation: 'dga',
    name: 'Directors Guild of America',
    nomDate: null,
    nomTime: 46800000,
    awardsDate: null,
    awardsTime: 90000000,
    nomInstant: null,
    awardsInstant: null,
    nomCurrent: false,
    awardsCurrent: false,
    nomTimeOfDay: 46800000,
    awardsTimeOfDay: 90000000,
  },
];

const STATE = { activeYear: 2026, shows: SHOWS };

const PLAN = {
  kind: 'dates',
  year: 2026,
  sources: ['https://dga.org/awards'],
  shows: [
    {
      abbreviation: 'dga',
      nominations: { date: '2026-01-08', time: '08:00', tz: 'America/New_York' },
      awards: { date: '2026-02-07', time: '20:00', tz: 'America/New_York' },
    },
  ],
};

describe('validateDatesPlan', () => {
  it('accepts a well-formed plan', () => {
    expect(validateDatesPlan(PLAN, SHOWS)).toEqual([]);
  });

  it('rejects an abbreviation that is not a real show', () => {
    const bad = { ...PLAN, shows: [{ ...PLAN.shows[0], abbreviation: 'nope' }] };
    expect(validateDatesPlan(bad, SHOWS)).toContain('"nope" is not a show');
  });

  it('rejects a plan with no sources recorded', () => {
    expect(validateDatesPlan({ ...PLAN, sources: [] }, SHOWS)).toContain(
      'the plan records no source URL',
    );
  });

  it('rejects the wrong kind', () => {
    expect(validateDatesPlan({ ...PLAN, kind: 'nominations' }, SHOWS)).toContain(
      'kind must be "dates"',
    );
  });

  it('rejects a show entry with neither nominations nor awards', () => {
    const bad = { ...PLAN, shows: [{ abbreviation: 'dga' }] };
    expect(validateDatesPlan(bad, SHOWS)).toContain(
      'dga names neither a nominations date nor an awards date',
    );
  });
});

describe('applyDates', () => {
  function fakeDbClient() {
    const ran = [];
    return {
      ran,
      async query(text, params) {
        ran.push({ text, params });
        return { rows: [] };
      },
    };
  }

  it('writes nothing without --commit', async () => {
    const client = fakeDbClient();
    const report = await applyDates(client, PLAN, STATE, { commit: false });
    expect(report.changes).toHaveLength(2);
    expect(client.ran.some((call) => /UPDATE events/.test(call.text))).toBe(false);
  });

  // 🔴 Refuse before the first write, not after it. Writing and then failing to
  // revalidate leaves production written but serving the old schedule.
  it('refuses --commit without REVALIDATE_SECRET and writes nothing', async () => {
    const client = fakeDbClient();
    await expect(
      applyDates(client, PLAN, STATE, { commit: true, secret: null }),
    ).rejects.toThrow(/REVALIDATE_SECRET/);
    expect(client.ran).toHaveLength(0);
  });

  it('writes the split, not the instant', async () => {
    const client = fakeDbClient();
    await applyDates(client, PLAN, STATE, { commit: true, secret: 'test-secret' });
    const update = client.ran.find((call) => /nom_date/.test(call.text));
    // 8am ET on 8 January → UTC midnight of the 8th, plus 13 hours.
    expect(update.params).toContain(Date.parse('2026-01-08T00:00:00Z'));
    expect(update.params).toContain(13 * 3600000);
  });

  // 🔴 The same failure the nominations year check exists for: a plausible,
  // complete, entirely wrong season.
  it('refuses a date outside the season window and writes nothing', async () => {
    const client = fakeDbClient();
    const bad = {
      ...PLAN,
      shows: [
        {
          abbreviation: 'dga',
          nominations: { date: '2027-01-08', time: '08:00', tz: 'America/New_York' },
        },
      ],
    };
    await expect(
      applyDates(client, bad, STATE, { commit: true, secret: 'test-secret' }),
    ).rejects.toThrow(/outside the 2026 season/);
    expect(client.ran.some((call) => /UPDATE events/.test(call.text))).toBe(false);
  });

  it('refuses a plan year that is not the active season', async () => {
    const client = fakeDbClient();
    await expect(
      applyDates(client, { ...PLAN, year: 2025 }, STATE, {
        commit: true,
        secret: 'test-secret',
      }),
    ).rejects.toThrow(/not the active season/);
    expect(client.ran).toHaveLength(0);
  });

  // The owner's rule: a re-run only researches and writes what is new.
  it('skips a field that is already current for this season', async () => {
    const client = fakeDbClient();
    const current = {
      activeYear: 2026,
      shows: [
        { ...SHOWS[0], nomCurrent: true, nomInstant: Date.parse('2026-01-08T13:00:00Z') },
      ],
    };
    const report = await applyDates(client, PLAN, current, {
      commit: true,
      secret: 'test-secret',
    });
    expect(report.changes.map((change) => change.field)).toEqual(['awards']);
    expect(report.skipped[0]).toMatchObject({
      abbreviation: 'dga',
      field: 'nominations',
    });
  });

  it('writes a skipped field anyway when the entry sets recheck', async () => {
    const client = fakeDbClient();
    const current = {
      activeYear: 2026,
      shows: [
        { ...SHOWS[0], nomCurrent: true, nomInstant: Date.parse('2026-01-08T13:00:00Z') },
      ],
    };
    const plan = { ...PLAN, shows: [{ ...PLAN.shows[0], recheck: true }] };
    const report = await applyDates(client, plan, current, {
      commit: true,
      secret: 'test-secret',
    });
    expect(report.changes.map((change) => change.field)).toEqual([
      'nominations',
      'awards',
    ]);
  });

  // 🔴 A show that announced nothing must keep what it has — never nulled.
  it('leaves the ceremony columns untouched when the entry omits awards', async () => {
    const client = fakeDbClient();
    const plan = {
      ...PLAN,
      shows: [
        {
          abbreviation: 'dga',
          nominations: { date: '2026-01-08', time: '08:00', tz: 'America/New_York' },
        },
      ],
    };
    await applyDates(client, plan, STATE, { commit: true, secret: 'test-secret' });
    expect(client.ran.some((call) => /awards_date/.test(call.text))).toBe(false);
  });

  // A source giving only a date is the common case.
  it('reuses the show existing time when the entry omits one', async () => {
    const client = fakeDbClient();
    const plan = {
      ...PLAN,
      shows: [{ abbreviation: 'dga', nominations: { date: '2026-01-08' } }],
    };
    await applyDates(client, plan, STATE, { commit: true, secret: 'test-secret' });
    const update = client.ran.find((call) => /nom_date/.test(call.text));
    expect(update.params).toContain(46800000);
  });

  // 🔴 Reuse means the wall-clock time, not the stored milliseconds. A ceremony
  // last held at 8pm EST (stored 25h) and reused for a date inside daylight
  // saving must land at 8pm EDT — 24h — not keep 25h and drift to 9pm.
  it('reuses the existing wall-clock time across a daylight-saving change', async () => {
    const client = fakeDbClient();
    const state = {
      activeYear: 2026,
      shows: [{ ...SHOWS[0], awardsDate: Date.parse('2025-01-11T00:00:00Z') }],
    };
    const plan = {
      ...PLAN,
      shows: [{ abbreviation: 'dga', awards: { date: '2026-03-15' } }],
    };
    const report = await applyDates(client, plan, state, { commit: false });
    expect(report.changes[0]).toMatchObject({
      date: Date.parse('2026-03-15T00:00:00Z'),
      time: 24 * 3600000,
      timeDefaulted: false,
    });
  });

  it('falls back to the default time, and says so, when the show has none', async () => {
    const client = fakeDbClient();
    const state = {
      activeYear: 2026,
      shows: [{ ...SHOWS[0], nomTime: null, nomTimeOfDay: null }],
    };
    const plan = {
      ...PLAN,
      shows: [{ abbreviation: 'dga', nominations: { date: '2026-01-08' } }],
    };
    const report = await applyDates(client, plan, state, { commit: false });
    expect(report.changes[0]).toMatchObject({ time: 13 * 3600000, timeDefaulted: true });
  });

  it('refuses a malformed date before computing anything', async () => {
    const bad = {
      ...PLAN,
      shows: [{ abbreviation: 'dga', nominations: { date: 'Jan 8' } }],
    };
    expect(validateDatesPlan(bad, SHOWS)).toContain(
      'dga nominations date must be YYYY-MM-DD',
    );
  });
});
