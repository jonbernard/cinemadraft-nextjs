import { describe, expect, it } from 'vitest';

import { leagueHref, legacyLeagueRedirect, parseLeagueSegment } from './league-href';

describe('leagueHref', () => {
  it('spells the three shapes, with tv as the only query parameter', () => {
    expect(leagueHref(70)).toBe('/leagues/70');
    expect(leagueHref(70, { year: 2027 })).toBe('/leagues/70/2027');
    expect(leagueHref(70, { year: 2027, group: 1 })).toBe('/leagues/70/2027/group/1');
    expect(leagueHref(70, { tv: true })).toBe('/leagues/70?tv=1');
    expect(leagueHref(70, { year: 2027, group: 1, tv: true })).toBe(
      '/leagues/70/2027/group/1?tv=1',
    );
  });

  it('drops the year for the current season, unless a group follows it', () => {
    expect(leagueHref(70, { year: 2026, activeYear: 2026 })).toBe('/leagues/70');
    expect(leagueHref(70, { year: 2026, activeYear: 2026, tv: true })).toBe(
      '/leagues/70?tv=1',
    );
    expect(leagueHref(70, { year: 2025, activeYear: 2026 })).toBe('/leagues/70/2025');
    expect(leagueHref(70, { year: 2026, group: 2, activeYear: 2026 })).toBe(
      '/leagues/70/2026/group/2',
    );
  });

  it('leaves tv off when it is false', () => {
    expect(leagueHref(70, { year: 2027, group: 1, tv: false })).toBe(
      '/leagues/70/2027/group/1',
    );
  });
});

describe('parseLeagueSegment', () => {
  it('reads canonical digits and nothing else', () => {
    expect(parseLeagueSegment('2027')).toBe(2027);
    expect(parseLeagueSegment('1')).toBe(1);
    for (const bad of [
      undefined,
      '',
      '0',
      '02027',
      '1e3',
      '+1',
      '-4',
      '2.5',
      'abc',
      'draft',
    ]) {
      expect(parseLeagueSegment(bad)).toBeNull();
    }
  });
});

describe('legacyLeagueRedirect', () => {
  const ACTIVE = 2026;

  it('maps the owner’s example to the path form, keeping tv', () => {
    expect(
      legacyLeagueRedirect(70, { year: '2027', group: '1', tv: '1' }, ACTIVE),
    ).toEqual({
      href: '/leagues/70/2027/group/1?tv=1',
      permanent: true,
    });
  });

  it('maps year alone, with and without tv', () => {
    expect(legacyLeagueRedirect(70, { year: '2025' }, ACTIVE)).toEqual({
      href: '/leagues/70/2025',
      permanent: true,
    });
    expect(legacyLeagueRedirect(70, { year: '2025', tv: '1' }, ACTIVE)).toEqual({
      href: '/leagues/70/2025?tv=1',
      permanent: true,
    });
  });

  it('keeps an explicit current year in the path, so the permanent redirect never moves', () => {
    // A 308 to the bare URL would be cached, and send this 2026 link to 2027
    // the day the season rolls over.
    expect(legacyLeagueRedirect(70, { year: String(ACTIVE) }, ACTIVE)).toEqual({
      href: `/leagues/70/${ACTIVE}`,
      permanent: true,
    });
  });

  it('borrows the current season for a group with no year, temporarily', () => {
    expect(legacyLeagueRedirect(70, { group: '2', tv: '1' }, ACTIVE)).toEqual({
      href: `/leagues/70/${ACTIVE}/group/2?tv=1`,
      permanent: false,
    });
  });

  it('drops a malformed value rather than carrying it', () => {
    expect(legacyLeagueRedirect(70, { year: 'abc', tv: '1' }, ACTIVE)).toEqual({
      href: '/leagues/70?tv=1',
      permanent: true,
    });
    expect(legacyLeagueRedirect(70, { year: '2027', group: 'x' }, ACTIVE)).toEqual({
      href: '/leagues/70/2027',
      permanent: true,
    });
  });

  it('reads the first of a repeated parameter', () => {
    expect(legacyLeagueRedirect(70, { year: ['2025', '2024'] }, ACTIVE)?.href).toBe(
      '/leagues/70/2025',
    );
  });

  it('leaves a URL with neither parameter alone, tv or not', () => {
    expect(legacyLeagueRedirect(70, {}, ACTIVE)).toBeNull();
    expect(legacyLeagueRedirect(70, { tv: '1' }, ACTIVE)).toBeNull();
  });
});
