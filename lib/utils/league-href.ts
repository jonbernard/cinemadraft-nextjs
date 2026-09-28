/**
 * League page URLs: the season and the group are path segments (D139).
 *
 * - `/leagues/70`: the site's current season.
 * - `/leagues/70/2027`: that season.
 * - `/leagues/70/2027/group/1`: that season and group.
 * - `?tv=1` stays a query parameter on all three (D112).
 *
 * 🔴 **The current season is the bare URL.** `/leagues/70/<active year>` with
 * nothing after it redirects there, and this builder never spells it — pass
 * `activeYear` and it drops the year when that is the one it was given. The
 * redirect is a 307, not a 308, because "current" moves at rollover: a
 * browser-cached permanent redirect from `/leagues/70/2026` to `/leagues/70`
 * would send a 2026 link to 2027 the day the admin moves the season.
 *
 * Import-free, so client components can spell a league URL too. Every league
 * page link goes through `leagueHref`; `scripts/layering.sh` refuses a
 * hand-built `/leagues/${id}?…` or `/leagues/${id}/${year}`.
 */
export function leagueHref(
  leagueId: number,
  {
    year,
    group,
    tv = false,
    activeYear,
  }: {
    year?: number | null;
    /** Only meaningful with a year: the group segment sits under the season's. */
    group?: number | null;
    tv?: boolean;
    /** The site's current season. When `year` is it and there is no group, the URL is bare. */
    activeYear?: number | null;
  } = {},
): string {
  let path = `/leagues/${leagueId}`;
  if (year != null && (group != null || year !== activeYear)) {
    path += `/${year}`;
    if (group != null) path += `/group/${group}`;
  }
  return tv ? `${path}?tv=1` : path;
}

/**
 * A league tab's URL (P16.T19): the board is `leagueHref`; the other tabs are
 * static children of `/leagues/[id]` that win over `[year]` (D139) and carry
 * a season other than the current one as `?year=`.
 */
export function leagueTabHref(
  leagueId: number,
  tab: 'board' | 'standings' | 'race',
  { year, activeYear }: { year?: number | null; activeYear?: number | null } = {},
): string {
  if (tab === 'board') return leagueHref(leagueId, { year, activeYear });
  const path = `/leagues/${leagueId}/${tab}`;
  return year != null && year !== activeYear ? `${path}?year=${year}` : path;
}

/** A seat's season page (P16.T21): a static child too, and the draft fixes the season. */
export function seatHref(leagueId: number, draftId: number): string {
  return `/leagues/${leagueId}/seats/${draftId}`;
}

/**
 * A `[year]` or `[group]` segment as a number, or null.
 *
 * Canonical digits only: `2027` and `1`, never `02027`, `1e3` or `+1`, which
 * `Number()` would all accept and which would give one page several URLs. A
 * value that parses still has to exist for the league — the page checks that.
 */
export function parseLeagueSegment(segment: string | undefined): number | null {
  return segment != null && /^[1-9]\d{0,8}$/.test(segment) ? Number(segment) : null;
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Where a pre-D139 URL goes: `/leagues/70?year=2027&group=1&tv=1` →
 * `/leagues/70/2027/group/1?tv=1`, or null when it carries neither parameter.
 *
 * 🔴 Permanent only when the target means the same thing forever. An explicit
 * year does — the link in last season's group chat should always open that
 * season, so it maps to the year form, never to the bare URL even when the
 * year is today's current one (the year form then 307s on, see above). A
 * `?group=` with no year borrows the current season, which moves, so that one
 * is temporary.
 *
 * Nothing is validated against the league here: a year or group it does not
 * have is the target route's 404. A malformed value (`?year=abc`) is dropped,
 * which is what the page used to do with it.
 */
export function legacyLeagueRedirect(
  leagueId: number,
  params: SearchParams,
  activeYear: number,
): { href: string; permanent: boolean } | null {
  if (params.year === undefined && params.group === undefined) return null;
  const first = (value: string | string[] | undefined) =>
    parseLeagueSegment(Array.isArray(value) ? value[0] : value);
  const year = first(params.year);
  const group = first(params.group);
  const tv = params.tv === '1';

  if (group != null && year == null) {
    return {
      href: leagueHref(leagueId, { year: activeYear, group, tv }),
      permanent: false,
    };
  }
  return { href: leagueHref(leagueId, { year, group, tv }), permanent: true };
}
