import { describe, expect, it } from 'vitest';

import { entryStatus } from './entry-status';

const HOUR = 3_600_000;

/**
 * The Oscars' real 2026 split (dates spec): nominations announced 8:00 AM ET on
 * 22 January — that day's UTC midnight plus 13 h — and the ceremony at 9:30 PM
 * ET on 15 March, stored as the 15th's midnight plus **25.5 h**, because it is
 * already the 16th in UTC. March is daylight time, so ET is UTC−4 there.
 */
const OSCARS = {
  hasCeremony: true,
  nomDate: Date.UTC(2026, 0, 22),
  nomTime: 13 * HOUR,
  awardsDate: Date.UTC(2026, 2, 15),
  awardsTime: 25.5 * HOUR,
};

const NOTHING = { nominations: 0, categoriesWithNominees: 0, categoriesDecided: 0 };
const SLATE = { nominations: 120, categoriesWithNominees: 24, categoriesDecided: 0 };

const at = (iso: string) => Date.parse(iso);

describe('entryStatus', () => {
  it('needs nothing before the nominations are announced', () => {
    expect(entryStatus(OSCARS, 2026, NOTHING, at('2026-01-10T12:00:00Z'))).toEqual({
      needsNominations: false,
      needsWinners: false,
    });
  });

  it('is not due at the date’s midnight — only at the announcement itself', () => {
    // 05:00 ET on the 22nd: the date column has passed, the instant has not.
    // Reading `nom_date` without `nom_time` gets this wrong.
    expect(
      entryStatus(OSCARS, 2026, NOTHING, at('2026-01-22T10:00:00Z')).needsNominations,
    ).toBe(false);
    expect(
      entryStatus(OSCARS, 2026, NOTHING, at('2026-01-22T13:00:00Z')).needsNominations,
    ).toBe(true);
  });

  it('needs nominations once the announcement has passed and none are entered', () => {
    expect(entryStatus(OSCARS, 2026, NOTHING, at('2026-01-23T00:00:00Z'))).toEqual({
      needsNominations: true,
      needsWinners: false,
    });
  });

  it('stops needing them as soon as any are entered', () => {
    expect(
      entryStatus(OSCARS, 2026, { ...SLATE, nominations: 1 }, at('2026-01-23T00:00:00Z'))
        .needsNominations,
    ).toBe(false);
  });

  it('needs winners once the ceremony has passed with a category still open', () => {
    expect(
      entryStatus(
        OSCARS,
        2026,
        { ...SLATE, categoriesDecided: 23 },
        at('2026-03-17T00:00:00Z'),
      ),
    ).toEqual({ needsNominations: false, needsWinners: true });
  });

  it('needs nothing once every category with nominees has its winner', () => {
    expect(
      entryStatus(
        OSCARS,
        2026,
        { ...SLATE, categoriesDecided: 24 },
        at('2026-03-17T00:00:00Z'),
      ).needsWinners,
    ).toBe(false);
  });

  it('takes the ceremony instant past 24 h, and in daylight time', () => {
    // 🔴 01:00Z on the 16th is 9:00 PM ET on the 15th (UTC−4 in March): past
    // the date column plus 24 h, half an hour before the envelope. A 24 h
    // clamp, or a UTC−5 conversion, calls the ceremony over here.
    expect(
      entryStatus(OSCARS, 2026, SLATE, at('2026-03-16T01:00:00Z')).needsWinners,
    ).toBe(false);
    expect(
      entryStatus(OSCARS, 2026, SLATE, at('2026-03-16T01:30:00Z')).needsWinners,
    ).toBe(true);
  });

  it('ignores last season’s dates still on the row at the start of this one', () => {
    // A show has one row of dates, overwritten each season. In September 2026
    // every show still carries its 2026 dates, all past — the 2027 season has
    // nothing due until its own dates are recorded.
    expect(entryStatus(OSCARS, 2027, NOTHING, at('2026-09-15T00:00:00Z'))).toEqual({
      needsNominations: false,
      needsWinners: false,
    });
  });

  it('needs nothing for a show with no dates', () => {
    // AFI has a nominations date and no ceremony — correct, not outstanding.
    const afi = { ...OSCARS, awardsDate: null, awardsTime: null };
    expect(entryStatus(afi, 2026, SLATE, at('2026-06-01T00:00:00Z')).needsWinners).toBe(
      false,
    );
    expect(
      entryStatus(
        {
          hasCeremony: true,
          nomDate: null,
          nomTime: null,
          awardsDate: null,
          awardsTime: null,
        },
        2026,
        NOTHING,
        at('2026-06-01T00:00:00Z'),
      ),
    ).toEqual({ needsNominations: false, needsWinners: false });
  });

  it('never needs winners for a show with no ceremony, even with a dated, passed ceremony', () => {
    // 🔴 The date is deliberately present and past: a stale awards date left on
    // the AFI's row must not make it "need winners" (D129). The flag decides.
    const noCeremony = { ...OSCARS, hasCeremony: false };
    expect(
      entryStatus(noCeremony, 2026, SLATE, at('2026-03-17T00:00:00Z')).needsWinners,
    ).toBe(false);
    expect(
      entryStatus(noCeremony, 2026, NOTHING, at('2026-01-23T00:00:00Z')).needsNominations,
    ).toBe(true);
  });
});
