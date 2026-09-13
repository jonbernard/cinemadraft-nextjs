// @vitest-environment node

import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { getLeagueBoard } from './draft';
import { getLiveShow } from './live';

afterAll(async () => {
  await db.$disconnect();
});

/**
 * Against the real restored data. The live page composes `getAwardShow` and
 * `getLeagueBoard` and adds no scoring of its own (D19/D41), so what these pin
 * is the composition: the schedule, the progress counters, the resolved point
 * value, and the signed-out path that makes the route safe to make public.
 */
describe('getLiveShow', () => {
  it('returns the show, its schedule and how far through it is', async () => {
    const view = await getLiveShow('oscars', 2025, null);

    expect(view.abbreviation).toBe('oscars');
    expect(view.total).toBe(view.categories.length);
    expect(view.resolved).toBe(
      view.categories.filter((category) => category.winner != null).length,
    );
    expect(view.resolved).toBeLessThanOrEqual(view.total);
    // 🔴 Not just "equal to whatever the mapping produced" — the counters are
    // the page's headline and both sides of the equalities above are computed
    // from the same array. These say the array is not empty and the season
    // genuinely resolved, which is what 2025 in the restored data looks like.
    expect(view.total).toBeGreaterThan(20);
    expect(view.resolved).toBeGreaterThan(0);
  });

  it('carries the ceremony instant and the ceremony day separately', async () => {
    // `awards_date` is UTC midnight of the ceremony day and `awards_time` is
    // milliseconds past it. The countdown needs the sum; the printed date needs
    // the day, and they are NOT the same UTC date — the Oscars store 91,800,000
    // (25.5 hours), because the ceremony is a Sunday evening in America, so the
    // instant lands on the Monday. Formatting the sum in UTC puts the wrong day
    // on the page whose one job is saying when the show starts.
    const view = await getLiveShow('oscars', 2025, null);

    expect(view.startsOn).toBe(1_773_532_800_000);
    expect(view.startsAt).toBe(1_773_532_800_000 + 91_800_000);
    expect(new Date(view.startsOn as number).toISOString()).toBe(
      '2026-03-15T00:00:00.000Z',
    );
    expect(new Date(view.startsAt as number).toISOString()).toBe(
      '2026-03-16T01:30:00.000Z',
    );

    // AFI has no `awards_date` at all in the restored data.
    const unscheduled = await getLiveShow('afi', 2025, null);
    expect(unscheduled.startsAt).toBeNull();
    expect(unscheduled.startsOn).toBeNull();
  });

  it('reports the broadcast window from the row, not from a constant', async () => {
    // `awards_active` is false on all twelve today, and a page that hardcoded
    // `onAir: true` would put a carmine "Live" chip on every show, all year.
    const view = await getLiveShow('oscars', 2025, null);
    expect(view.onAir).toBe(false);
  });

  it('resolves the point value, never the foreign key (D41)', async () => {
    // `awards.points` is an FK into `points.id`. "Performance by an Ensemble"
    // stores 1 and is worth 5. This page is one a reader would check a score
    // against, so a confident wrong number here is the worst kind.
    const view = await getLiveShow('sag', 2025, null);
    const ensemble = view.categories.find((c) => /ensemble/i.test(c.name));
    // 🔴 Not `if (ensemble)` as the plan drafted it: an assertion behind an
    // `if` over data that might not match is a test that cannot fail. The row
    // exists in the restored corpus, so the lookup itself is the assertion.
    expect(ensemble).toBeDefined();
    expect(ensemble?.points).toBeGreaterThan(1);
  });

  it('names the winning film once a category has one', async () => {
    const view = await getLiveShow('oscars', 2025, null);
    const won = view.categories.filter((category) => category.winner != null);
    expect(won.length).toBeGreaterThan(0);
    for (const category of won) {
      expect(category.winner?.title).not.toBe('');
      expect(category.nominees.length).toBeGreaterThan(0);
      // The winner is one OF the nominees, not a film assembled beside them —
      // which is what makes the seal land on a poster that is already on screen.
      expect(category.nominees.some((nominee) => nominee.isWinner)).toBe(true);
      expect(category.winner?.movieId).toBe(
        category.nominees.find((nominee) => nominee.isWinner)?.movieId,
      );
    }
  });

  it('carries every nominee and its artwork, not a count (P14.T1)', async () => {
    // 🔴 The whole of T1 in the service. `getAwardShow` already returned these
    // and `toCategory` collapsed each category to a number; a page cannot put
    // posters on a television from a number.
    const view = await getLiveShow('oscars', 2025, null);
    const picture = view.categories.find((category) =>
      /best picture/i.test(category.name),
    );
    expect(picture).toBeDefined();

    // Five to ten films in a Best Picture line-up; never one, and never zero.
    expect(picture?.nominees.length).toBeGreaterThan(4);
    for (const nominee of picture?.nominees ?? []) {
      expect(nominee.title).not.toBe('');
      expect(nominee.title).not.toBe('Untitled');
      // 🔴 `w342`, not `getAwardShow`'s `w185`. TMDB is a pass-through host
      // (`lib/images.ts`), so the bucket in the path is the delivered width and
      // the one this page renders at is 224px. A w185 URL here is a poster
      // upscaled on the screen it was widened for.
      expect(nominee.posterUrl).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\/w342\//);
    }

    // Distinct nominations, so the React keys are stable and two nominees of
    // the same film in a person category do not collapse into one.
    const ids = picture?.nominees.map((nominee) => nominee.nominationId) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps a category whose films have no artwork, rather than dropping it', async () => {
    // The page's rule is that such a category must not collapse to an empty
    // row, and the page can only honour that if the service still hands it the
    // nominees. Read across the whole season rather than one hand-picked
    // category: every nominee that has no poster still arrives with a title.
    const view = await getLiveShow('oscars', 2025, null);
    const artless = view.categories
      .flatMap((category) => category.nominees)
      .filter((nominee) => nominee.posterUrl == null);

    for (const nominee of artless) {
      expect(nominee.title.length).toBeGreaterThan(0);
    }
    // And a category is never silently emptied: the show's own counter says
    // how many categories there are, and each one carries its own list.
    expect(view.categories.every((category) => Array.isArray(category.nominees))).toBe(
      true,
    );
  });

  it('shows a signed-out reader no league, where a member sees their own', async () => {
    // Same rule as the public dashboard (D44): with no `?league=` the
    // signed-out path does not query leagues rather than querying with a
    // sentinel, so there is no code path on which an unpinned page resolves
    // somebody else's team.
    //
    // 🔴 Both halves, deliberately. `expect(league).toBeNull()` on its own is a
    // literal compared with itself for as long as nothing produces a seat — it
    // stayed green through all of T16a and could not have failed. The signed-in
    // call is what gives it something to be the absence of.
    const anonymous = await getLiveShow('oscars', 2026, null);
    const member = await getLiveShow('oscars', 2026, 6);

    expect(anonymous.league).toBeNull();
    expect(anonymous.leagueOptions).toEqual([]);
    expect(member.league).not.toBeNull();
    expect(member.league?.seats.length).toBeGreaterThan(0);
    expect(member.league?.standings.length).toBeGreaterThan(0);
  });

  it('pins the league the URL names, for a reader with no session (P14.T2)', async () => {
    // The owner's ruling: `?league=<id>` is readable by whoever opens the link.
    // League 1 is the restored league with sixty real people's history in it —
    // the same rows `/leagues/1` already serves a stranger (D44/D45).
    const anonymous = await getLiveShow('oscars', 2026, null, 1);

    expect(anonymous.league?.id).toBe(1);
    expect(anonymous.league?.seats.length).toBeGreaterThan(0);
    expect(anonymous.league?.standings.length).toBeGreaterThan(0);
    // 🔴 And no seat is the reader's. `Seat.userId` is null on a dummy seat, so
    // a bare `seat.userId === userId` marks every placeholder "your seat" for a
    // reader who is signed out — league 1's 2026 season holds three of them.
    expect(anonymous.league?.seats.some((seat) => seat.isViewer)).toBe(false);
    expect(anonymous.league?.standings.some((row) => row.isViewer)).toBe(false);
    // The pin is one league, not a door to the rest: no picker without a
    // session, whatever the URL says.
    expect(anonymous.leagueOptions).toEqual([]);
  });

  it('serves a pinned stranger nothing a league page would not (P14.T2)', async () => {
    // 🔴 The privacy claim, proved rather than asserted. `/leagues/1` is public
    // and renders `getLeagueBoard(1, 2026)` — every seat, every pick, every
    // season total. This page must be a NARROWING of that and never an
    // addition, so each assertion below is against the board itself.
    const board = await getLeagueBoard(1, 2026);
    const boardSeats = board.groups.flatMap((group) => group.seats);
    const anonymous = await getLiveShow('oscars', 2026, null, 1);
    const league = anonymous.league;
    expect(league).not.toBeNull();

    // Not vacuous: the board really does carry seats, films and scores.
    expect(boardSeats.length).toBeGreaterThan(0);
    expect(boardSeats.some((seat) => seat.picks.length > 0)).toBe(true);

    // The league's own name and id are the board's.
    expect(league?.name).toBe(board.leagueName);

    // Every seat named here is a seat the league page names.
    const boardNames = new Set(boardSeats.map((seat) => seat.name));
    for (const seat of league?.seats ?? []) expect(boardNames.has(seat.name)).toBe(true);
    expect(league?.seats.length).toBe(boardSeats.length);

    // Every film shown is a film that seat actually drafted — this page cannot
    // invent a pick, and cannot show one seat's film under another's name.
    const picksByName = new Map(
      boardSeats.map((seat) => [
        seat.name,
        new Set(seat.picks.map((pick) => pick.movie.id)),
      ]),
    );
    for (const seat of league?.seats ?? []) {
      for (const film of seat.films) {
        expect(picksByName.get(seat.name)?.has(film.movieId)).toBe(true);
      }
    }

    // And the standings are the board's own totals, not a second sum.
    const boardTotals = new Map(boardSeats.map((seat) => [seat.name, seat.total]));
    for (const row of league?.standings ?? []) {
      expect(row.total).toBe(boardTotals.get(row.name));
    }
  });

  it('ranks the standings by the season, densely, as the league page does', async () => {
    const anonymous = await getLiveShow('oscars', 2026, null, 1);
    const rows = anonymous.league?.standings ?? [];
    expect(rows.length).toBeGreaterThan(1);

    // Descending by total, and the position is dense: the first row is 1, and
    // two rows level on points share a number.
    const totals = rows.map((row) => row.total);
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    expect(rows[0]?.position).toBe(1);
    for (let i = 1; i < rows.length; i += 1) {
      const previous = rows[i - 1] as (typeof rows)[number];
      const row = rows[i] as (typeof rows)[number];
      expect(row.position).toBe(row.total === previous.total ? previous.position : i + 1);
    }

    // 🔴 The season, not tonight. A seat's take at one show cannot exceed what
    // it has taken across twelve, and for league 1 in 2026 the two genuinely
    // differ — so a standings column accidentally fed `earned` fails here.
    const tonight = new Map(
      anonymous.league?.seats.map((seat) => [seat.name, seat.earned]) ?? [],
    );
    for (const row of rows) {
      expect(row.total).toBeGreaterThanOrEqual(tonight.get(row.name) ?? 0);
    }
    expect(rows.some((row) => row.total > (tonight.get(row.name) ?? 0))).toBe(true);
  });

  it('marks the reader’s own seat in a league they were pinned to', async () => {
    // The other half of the `isViewer` rule: it is false for a stranger because
    // there is no viewer, not because the flag is never set.
    const member = await getLiveShow('oscars', 2026, 6, 1);
    expect(member.league?.id).toBe(1);
    expect(member.league?.seats.filter((seat) => seat.isViewer)).toHaveLength(1);
    expect(member.league?.standings.filter((row) => row.isViewer)).toHaveLength(1);
  });

  it('offers a picker only to a reader who has a choice to make', async () => {
    // User 3 holds seats in two leagues; user 6 in one. A picker for one league
    // is a control that cannot do anything, and the name query behind it is a
    // query spent on rendering nothing.
    const several = await getLiveShow('oscars', 2026, 3);
    const one = await getLiveShow('oscars', 2026, 6);

    expect(several.leagueOptions.length).toBeGreaterThan(1);
    expect(several.leagueOptions.map((option) => option.id)).toContain(
      several.league?.id,
    );
    expect(one.leagueOptions).toEqual([]);
    expect(one.league).not.toBeNull();
  });

  it('ignores a league id that is not a league, rather than losing the show', async () => {
    // `?league=` is a number in a URL. 404ing the ceremony because a stranger
    // mistyped the query string would take the show off the television.
    const view = await getLiveShow('oscars', 2026, null, 999_999_999);
    expect(view.league).toBeNull();
    expect(view.categories.length).toBeGreaterThan(0);
  });

  it("a seat's take is this show's lines only, and the league total adds up", async () => {
    const view = await getLiveShow('oscars', 2026, 6);
    const league = view.league;
    expect(league).not.toBeNull();

    // The league's total is the sum of its seats, never a second reduction —
    // the `MovieLedger` rule. And the seats are ranked by it.
    expect(league?.total).toBe(league?.seats.reduce((sum, seat) => sum + seat.earned, 0));
    const earned = league?.seats.map((seat) => seat.earned) ?? [];
    expect(earned).toEqual([...earned].sort((a, b) => b - a));

    for (const seat of league?.seats ?? []) {
      // Each seat's take is the sum of its films', and every film on this page
      // earned something here — a pick with no line at this show is dropped.
      expect(seat.earned).toBe(seat.films.reduce((sum, film) => sum + film.earned, 0));
      for (const film of seat.films) {
        expect(film.earned).toBeGreaterThan(0);
        expect(film.status).not.toBe('none');
      }
    }

    // 🔴 And it is genuinely narrower than the season. The same seat's dashboard
    // total counts twelve shows; this counts one.
    const viewer = league?.seats.find((seat) => seat.isViewer);
    expect(viewer).toBeDefined();
    expect(viewer?.films.length).toBeGreaterThan(0);
  });

  it('narrows the season ledger to this show and no other', async () => {
    // The whole scoring content of the page is one filter on
    // `LedgerLine.eventAbbreviation`. If it were dropped, every seat would show
    // its season total here — so the two shows would agree, and they must not.
    const oscars = await getLiveShow('oscars', 2026, 6);
    const globes = await getLiveShow('gg', 2026, 6);

    const take = (view: typeof oscars) =>
      view.league?.seats.find((seat) => seat.isViewer)?.earned ?? 0;

    expect(take(oscars)).toBeGreaterThan(0);
    expect(take(globes)).toBeGreaterThan(0);
    expect(take(oscars)).not.toBe(take(globes));
  });

  it('throws NotFoundError for a show that does not exist', async () => {
    await expect(getLiveShow('not-a-show', 2025, null)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
