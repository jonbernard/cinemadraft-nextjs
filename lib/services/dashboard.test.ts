// @vitest-environment node

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/lib/db';
import { clearCacheForTests } from '@/lib/external/cache';
import { draftRepository } from '@/lib/repositories/drafts';
import { getDashboard } from './dashboard';

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

  it('🔴 does not assume a roster size (D34)', async () => {
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

  it('🔴 ranks ties densely — the normal state before anything is awarded', async () => {
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

  it('🔴 never divides by zero when nothing has scored', async () => {
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
  it('🔴 renders for a signed-out visitor without querying any leagues', async () => {
    const view = await getDashboard(null);

    expect(view.leagues).toEqual([]);
    expect(view.year).toBe(2026);
  });

  it('🔴 still shows the season — that is the point of the public page', async () => {
    // A login wall on the front page during awards season is the worst
    // possible first impression, and `/` was never guarded in the source app.
    const view = await getDashboard(null);
    expect(view.events.length).toBeGreaterThan(0);
  });

  it('🔴 leaks no user-scoped data on the public path', async () => {
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

  it('🔴 is empty when TMDB is unconfigured, not an error', async () => {
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
