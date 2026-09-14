// @vitest-environment node

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { clearCacheForTests } from '@/lib/external/cache';
import { draftRepository } from '@/lib/repositories/drafts';
import { type Event, eventRepository } from '@/lib/repositories/events';
import { getDashboard } from './dashboard';
import { pointsForMovieIds } from './scoring';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real restored data: league 1 is the only league that has ever
 * genuinely existed, and 2026 is the active season.
 *
 * A user with a seat is found from the data rather than hardcoded, so this
 * keeps working when the active season moves.
 */
async function aMemberOfLeague1(): Promise<number> {
  const drafts = await draftRepository.findByLeagueId(1);
  const withUser = drafts.find((draft) => draft.userId != null);
  if (!withUser?.userId) throw new Error('no drafts with a user in league 1');
  return withUser.userId;
}

describe('getDashboard', () => {
  it('returns the active season, not a hardcoded year', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    expect(view.year).toBe(2026);
  });

  it('includes the leagues the member has drafted in', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    expect(view.leagues.map((league) => league.id)).toContain(1);
  });

  it('returns an empty dashboard for someone with no leagues, not an error', async () => {
    // A brand-new member who has just claimed their account. This is the
    // empty-state path, and it must not throw on the way to rendering it.
    const view = await getDashboard(999_999);

    expect(view.leagues).toEqual([]);
    expect(view.year).toBe(2026);
  });

  it('does not assume a roster size (D34)', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const league = view.leagues.find((entry) => entry.id === 1);

    // Whatever the seat drafted. 2026 is mid-draft in the restored data, so
    // asserting any particular number here would be asserting the snapshot.
    expect(league?.roster.length).toBeGreaterThanOrEqual(0);
    expect(league?.roster.length).toBe(
      new Set(league?.roster.map((e) => e.movie.id)).size,
    );
  });

  it('orders the roster by draft round, never by points', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const rounds = view.leagues.find((l) => l.id === 1)?.roster.map((e) => e.round) ?? [];

    expect([...rounds]).toEqual([...rounds].sort((a, b) => a - b));
  });

  it('sorts standings by total, highest first', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const totals =
      view.leagues.find((l) => l.id === 1)?.standings.map((r) => r.total) ?? [];

    expect(totals.length).toBeGreaterThan(0);
    expect([...totals]).toEqual([...totals].sort((a, b) => b - a));
  });

  it('ranks ties densely — the normal state before anything is awarded', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const standings = view.leagues.find((l) => l.id === 1)?.standings ?? [];

    // Equal totals share a position; the next distinct total skips.
    for (let i = 1; i < standings.length; i += 1) {
      const previous = standings[i - 1] as (typeof standings)[number];
      const current = standings[i] as (typeof standings)[number];
      if (current.total === previous.total) {
        expect(current.position).toBe(previous.position);
      } else {
        expect(current.position).toBe(i + 1);
      }
    }
  });

  it('marks exactly one standings row as the viewer', async () => {
    const userId = await aMemberOfLeague1();
    const view = await getDashboard(userId);
    const standings = view.leagues.find((l) => l.id === 1)?.standings ?? [];

    expect(standings.filter((row) => row.isViewer)).toHaveLength(1);
    expect(standings.find((row) => row.isViewer)?.userId).toBe(userId);
  });

  it('a seat total equals the sum of its roster', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const league = view.leagues.find((l) => l.id === 1);

    const summed = league?.roster.reduce((sum, entry) => sum + entry.points, 0) ?? 0;
    expect(league?.total).toBe(summed);
  });

  it('sends the roster real artwork, not an initials box', async () => {
    // The dashboard was the last surface handing PosterFrame a null. A member's
    // own drafted team rendered as grey two-letter squares while the draft
    // console two clicks away showed the same films with posters.
    const view = await getDashboard(await aMemberOfLeague1());
    const entries = view.leagues.flatMap((league) => league.roster);
    expect(entries.length).toBeGreaterThan(0);

    const withArtwork = entries.filter((entry) => entry.posterUrl != null);
    expect(withArtwork.length).toBeGreaterThan(0);
    for (const entry of withArtwork) {
      // Built from the stored bare path through the one helper, at the roster
      // bucket — not w185, which is the draft-board cell.
      expect(entry.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w342\//);
    }
  });

  it('leaves a film with no stored poster on null rather than a broken URL', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    for (const entry of view.leagues.flatMap((league) => league.roster)) {
      if (entry.movie.poster == null) expect(entry.posterUrl).toBeNull();
    }
  });

  it('tells the roster which films were nominated and which won', async () => {
    // The winner seal has existed in PosterFrame since Phase 3.5 and has never
    // rendered: nothing in the app ever set `status`. The ledger already knows
    // — `MovieLedger.lines` carry `won` — so this is a read, not a new rule.
    const view = await getDashboard(await aMemberOfLeague1());
    const entries = view.leagues.flatMap((league) => league.roster);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      expect(['none', 'nominated', 'won']).toContain(entry.status);
      // 🔴 One direction only, and it is the airtight one: points come out of
      // the ledger's lines, so anything that scored must have a line and must
      // therefore not be 'none'. The converse is NOT asserted — a nomination
      // for an award whose points row resolves to 0 is honestly 'nominated'
      // on zero points, and a test forbidding that would be pinning an
      // accident of the data rather than the rule.
      if (entry.points > 0) expect(entry.status).not.toBe('none');
    }
  });

  it('marks some films won and others merely nominated', async () => {
    // Half of T15 is that the seal had never rendered, so both degenerate
    // answers have to fail here. All-'none' is the state being fixed; all-'won'
    // is the way a "fix" passes a union check while marking every poster —
    // member 6's real 2026 roster holds both kinds, so this discriminates.
    const view = await getDashboard(await aMemberOfLeague1());
    const statuses = view.leagues.flatMap((league) =>
      league.roster.map((entry) => entry.status),
    );

    expect(statuses).toContain('won');
    expect(statuses).toContain('nominated');
    // And a won film is one with a winning line, not merely a high-scoring
    // one: the two are different claims and only the ledger knows which.
    const won = view.leagues
      .flatMap((league) => league.roster)
      .filter((entry) => entry.status === 'won');
    expect(won.length).toBeLessThan(statuses.length);
  });

  it('keeps the seat totals it had before the ledger swap', async () => {
    // 🔴 Checked against `pointsForMovieIds` — the call the dashboard USED to
    // make — rather than against itself. Comparing `league.total` to the sum of
    // `entry.points` proves nothing: both are read out of the same map, so that
    // assertion holds however wrong the map is.
    //
    // ledgerForMovies and pointsForMovieIds are the same arithmetic over the
    // same inputs (D41). If this ever disagrees, one of them has grown a second
    // definition of the rule, and that is the bug to fix, not this number.
    const view = await getDashboard(await aMemberOfLeague1());
    const roster = view.leagues.flatMap((league) => league.roster);
    expect(roster.length).toBeGreaterThan(0);

    const reference = await pointsForMovieIds(
      roster.map((entry) => entry.movie.id),
      view.year,
    );
    for (const entry of roster) {
      expect(entry.points).toBe(reference.get(entry.movie.id) ?? 0);
    }

    // And the seat total is still the sum of what it is showing.
    for (const league of view.leagues) {
      const fromRoster = league.roster.reduce((sum, e) => sum + e.points, 0);
      expect(league.total).toBe(fromRoster);
    }
  });

  it('never divides by zero when nothing has scored', async () => {
    // Opening day: every seat is on zero. An unguarded share would make every
    // contribution bar NaN on the one day the most people are looking.
    const view = await getDashboard(await aMemberOfLeague1());
    const shares = view.leagues.flatMap((l) => l.roster.map((e) => e.share));

    for (const share of shares) {
      expect(Number.isFinite(share)).toBe(true);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  });

  it('emits one entry per show phase, in date order', async () => {
    const view = await getDashboard(null);
    const oscars = view.events.filter((phase) => phase.abbreviation === 'oscars');

    expect(oscars.map((phase) => phase.phase)).toEqual(['nominations', 'ceremony']);
    expect(oscars[0]?.key).toBe(`${oscars[0]?.eventId}-nominations`);
    // Nominations always precede their own ceremony.
    expect(oscars[0]?.date ?? 0).toBeLessThan(oscars[1]?.date ?? 0);
  });

  it('keeps an undated phase rather than dating it 1970', async () => {
    const view = await getDashboard(null);
    const undated = view.events.filter((phase) => phase.date == null);

    // Undated phases are kept and sorted last — a show with no announced
    // nominations date is a real state, and hiding it makes the season look
    // shorter than it is.
    for (const phase of undated) expect(phase.complete).toBe(false);
    if (undated.length > 0) expect(view.events.at(-1)?.date).toBeNull();
  });

  it('sorts events by date, with unscheduled shows last', async () => {
    const view = await getDashboard(await aMemberOfLeague1());
    const dated = view.events
      .filter((event) => event.date != null)
      .map((e) => e.date as number);

    expect(view.events.length).toBeGreaterThan(0);
    expect([...dated]).toEqual([...dated].sort((a, b) => a - b));
    // An undated show means "not scheduled yet", which is the far future.
    const firstUndated = view.events.findIndex((event) => event.date == null);
    if (firstUndated !== -1) {
      expect(view.events.slice(firstUndated).every((event) => event.date == null)).toBe(
        true,
      );
    }
  });
});

describe('the public dashboard (D44)', () => {
  it('renders for a signed-out visitor without querying any leagues', async () => {
    const view = await getDashboard(null);

    expect(view.leagues).toEqual([]);
    expect(view.year).toBe(2026);
  });

  it('still shows the season — that is the point of the public page', async () => {
    // A login wall on the front page during awards season is the worst
    // possible first impression, and `/` was never guarded in the source app.
    const view = await getDashboard(null);
    expect(view.events.length).toBeGreaterThan(0);
  });

  it('leaks no user-scoped data on the public path', async () => {
    // The guarantee is structural, not incidental: with no user there is no
    // roster and no standings anywhere in the payload, so there is no code
    // path on which the public page can render somebody else's team.
    const view = await getDashboard(null);

    expect(view.leagues.flatMap((league) => league.roster)).toEqual([]);
    expect(view.leagues.flatMap((league) => league.standings)).toEqual([]);
  });
});

/**
 * "In cinemas now" (P10.T2). TMDB is stubbed; the database is real, since
 * `getDashboard` runs the two side by side.
 */
describe('the now-playing shelf', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TMDB_API_KEY;
  });

  it('is empty when TMDB is unconfigured, not an error', async () => {
    delete process.env.TMDB_API_KEY;

    const view = await getDashboard(null);

    expect(view.nowPlaying).toEqual([]);
  });

  it('maps TMDB results into posters the shelf can render', async () => {
    clearCacheForTests();
    process.env.TMDB_API_KEY = 'test-tmdb-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({
              page: 1,
              results: [
                { id: 42, title: 'In Theaters', poster_path: '/42.jpg' },
                // No poster: dropped, the same as `discoverFilms`.
                { id: 43, title: 'No Poster', poster_path: null },
              ],
            }),
          }) as Response,
      ),
    );

    const view = await getDashboard(null);

    expect(view.nowPlaying).toEqual([
      {
        tmdbId: '42',
        title: 'In Theaters',
        posterUrl: expect.stringContaining('/42.jpg'),
      },
    ]);
  });
});

/**
 * The dashboard's route into a ceremony (P10.T3).
 *
 * 🔴 `eventRepository.findActive` is spied rather than arranged in the
 * database. The rest of this file reads the restored production data, and the
 * two cases here need the live flags set *differently* — arranging them for
 * real means writing `awards_active` on a row of sixty real people's season.
 * The rule under test is the filter, not the query, so the spy is the honest
 * boundary.
 */
describe('the live banner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function anEvent(overrides: Partial<Event>): Event {
    return {
      id: 1,
      fbId: null,
      name: 'Academy Awards',
      abbreviation: 'oscars',
      image: null,
      liveResults: true,
      nomActive: false,
      nomDate: null,
      nomTime: null,
      nomDuration: null,
      awardsActive: false,
      focusedAwardId: null,
      awardsDate: null,
      awardsTime: null,
      awardsDuration: null,
      createdAt: null,
      updatedAt: null,
      ...overrides,
    };
  }

  it('names the show that is handing out awards right now', async () => {
    vi.spyOn(eventRepository, 'findActive').mockResolvedValue([
      anEvent({ awardsActive: true }),
    ]);

    const view = await getDashboard(null);

    expect(view.liveNow).toEqual({
      abbreviation: 'oscars',
      name: 'Academy Awards',
      year: view.year,
    });
  });

  it('ignores a show that is only announcing nominations', async () => {
    // 🔴 Deliberate deviation from the source, which showed this one too and
    // linked to a live page whose stream answers 204 (D110). A banner into a
    // dead end is worse than no banner.
    vi.spyOn(eventRepository, 'findActive').mockResolvedValue([
      anEvent({ nomActive: true, awardsActive: false }),
    ]);

    const view = await getDashboard(null);

    expect(view.liveNow).toBeNull();
  });

  it('is null when nothing is on air', async () => {
    vi.spyOn(eventRepository, 'findActive').mockResolvedValue([]);

    const view = await getDashboard(null);

    expect(view.liveNow).toBeNull();
  });
});
