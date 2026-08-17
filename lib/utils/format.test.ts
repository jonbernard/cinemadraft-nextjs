import { describe, expect, it } from 'vitest';

import { formatMoney, formatReleaseDate, formatRuntime } from './format';

/**
 * Three formatters, and every case here is one the source app got wrong or
 * would have got wrong. The absences matter more than the happy paths: a fact
 * that is confidently wrong is worse than one that is missing.
 */

describe('formatRuntime', () => {
  it('🔴 formats the real runtime', () => {
    // 129 is La La Land's actual runtime. The source printed 1 hour 41 minutes
    // for every film in the catalogue — `moment.duration(101, 'minutes')` was a
    // literal and `movie.runtime` was never read (PARITY bug 12).
    expect(formatRuntime(129)).toBe('2 hours 9 minutes');
  });

  it('uses the singular for one hour and one minute', () => {
    expect(formatRuntime(61)).toBe('1 hour 1 minute');
  });

  it('omits the minutes for an exact number of hours', () => {
    expect(formatRuntime(120)).toBe('2 hours');
  });

  it('omits the hours for a short', () => {
    // Shorts are a real category in this league — D58 exists because of them.
    expect(formatRuntime(14)).toBe('14 minutes');
  });

  it('returns null for an unknown runtime rather than "0 minutes"', () => {
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats a budget with thousands separators and no cents', () => {
    expect(formatMoney(30_000_000)).toBe('$30,000,000');
  });

  it('🔴 returns null for 0, which TMDB uses to mean unknown', () => {
    // The source formatted it, so an announced-but-unmade film's page claimed a
    // budget of $0.
    expect(formatMoney(0)).toBeNull();
    expect(formatMoney(null)).toBeNull();
  });

  it('🔴 always formats as US dollars, whatever the reader’s locale', () => {
    // The figures arrive from TMDB in USD, so the currency is a property of the
    // data. A German reader must not be shown "30.000.000 $" as though the
    // number had been converted.
    expect(formatMoney(1_500)).toBe('$1,500');
  });
});

describe('formatReleaseDate', () => {
  it('formats a date in long form', () => {
    expect(formatReleaseDate(new Date('2016-12-09T00:00:00Z'))).toBe('December 9, 2016');
  });

  it('🔴 reads the date in UTC, not the machine’s zone', () => {
    // Without an explicit time zone a film released on the 1st renders as the
    // previous month for every reader west of UTC — and the browse page's month
    // grouping would then disagree with the film page's own date.
    expect(formatReleaseDate(new Date('2026-08-01T00:00:00Z'))).toBe('August 1, 2026');
  });

  it('returns null for an unknown date', () => {
    expect(formatReleaseDate(null)).toBeNull();
  });
});
