import { describe, expect, it, vi } from 'vitest';

import { buildCalendarFeed, type CalendarShow, escapeIcsText, foldIcsLine } from './ical';

const MIN = 60 * 1000;

/**
 * Three shows chosen so date order, name order and id order all disagree
 * (trap 3): Zenith/Ambit/Brevity alphabetically, Ambit/Brevity/Zenith by id,
 * but Zenith/Ambit/Brevity/Brevity by start. A sort test built on shows whose
 * orderings coincide would stay green with the comparator reversed.
 */
const zenith: CalendarShow = {
  id: 3,
  abbreviation: 'zen',
  name: 'Zenith Awards',
  nomDate: Date.UTC(2027, 0, 1),
  nomTime: 0,
  // Explicit and different from the 30-minute fallback (trap 2): a fixture
  // whose duration happens to equal the default cannot tell "used the
  // fallback" apart from "used the real value".
  nomDuration: 45 * MIN,
  awardsDate: null,
  awardsTime: null,
  awardsDuration: null,
};

const ambit: CalendarShow = {
  id: 1,
  abbreviation: 'amb',
  name: 'Ambit Awards',
  nomDate: null,
  nomTime: null,
  nomDuration: null,
  awardsDate: Date.UTC(2027, 0, 2),
  awardsTime: 0,
  // No duration recorded: this is the show that exercises the fallback.
  awardsDuration: null,
};

const brevity: CalendarShow = {
  id: 2,
  abbreviation: 'bre',
  name: 'Brevity Awards',
  nomDate: Date.UTC(2027, 0, 3),
  nomTime: 0,
  nomDuration: 20 * MIN,
  awardsDate: Date.UTC(2027, 0, 4),
  awardsTime: 0,
  awardsDuration: 90 * MIN,
};

const shows = [zenith, ambit, brevity];
const baseUrl = 'https://next.cinemadraft.com';

describe('buildCalendarFeed — presence (fixture adequacy)', () => {
  it('emits only a nominations event for a show with just nomDate set', () => {
    const body = buildCalendarFeed([zenith], { baseUrl });
    expect(body).toContain('SUMMARY:Zenith Awards Nominations');
    expect(body).not.toContain('SUMMARY:Zenith Awards Awards');
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('emits only an awards event for a show with just awardsDate set', () => {
    const body = buildCalendarFeed([ambit], { baseUrl });
    expect(body).toContain('SUMMARY:Ambit Awards Awards');
    expect(body).not.toContain('Nominations');
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('emits both events for a show with both dates set', () => {
    const body = buildCalendarFeed([brevity], { baseUrl });
    expect(body).toContain('SUMMARY:Brevity Awards Nominations');
    expect(body).toContain('SUMMARY:Brevity Awards Awards');
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it('emits nothing for a show with neither date set', () => {
    const body = buildCalendarFeed(
      [{ ...zenith, nomDate: null, nomTime: null, nomDuration: null }],
      { baseUrl },
    );
    expect(body).not.toContain('BEGIN:VEVENT');
  });
});

describe('buildCalendarFeed — duration', () => {
  it('falls back to 30 minutes when no duration is recorded', () => {
    const body = buildCalendarFeed([ambit], { baseUrl });
    const start = (ambit.awardsDate ?? 0) + (ambit.awardsTime ?? 0);
    const expectedEnd = start + 30 * MIN;
    expect(body).toContain(`DTEND:${isoBasic(expectedEnd)}`);
  });

  it('uses the recorded duration when present, not the fallback', () => {
    const body = buildCalendarFeed([zenith], { baseUrl });
    const start = (zenith.nomDate ?? 0) + (zenith.nomTime ?? 0);
    const expectedEnd = start + 45 * MIN;
    expect(body).toContain(`DTEND:${isoBasic(expectedEnd)}`);
    // Confirms the fallback fires only in the absence of a duration, not always.
    expect(body).not.toContain(`DTEND:${isoBasic(start + 30 * MIN)}`);
  });
});

describe('buildCalendarFeed — sort', () => {
  it('sorts every event by start across shows, not by name or id', () => {
    const body = buildCalendarFeed(shows, { baseUrl });
    const order = [...body.matchAll(/SUMMARY:(.+)/g)].map((m) => m[1]);
    expect(order).toEqual([
      'Zenith Awards Nominations',
      'Ambit Awards Awards',
      'Brevity Awards Nominations',
      'Brevity Awards Awards',
    ]);
  });
});

describe('buildCalendarFeed — UID', () => {
  it('is stable across independent calls, and distinct per event kind', () => {
    const first = uidsOf(buildCalendarFeed([brevity], { baseUrl }));
    const second = uidsOf(buildCalendarFeed([brevity], { baseUrl }));
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(new Set(first).size).toBe(2);
  });

  it('is derived from the row and the date kind, not the request time', () => {
    // The real clock, not just the injectable `now` — a UID built from
    // `Date.now()` would still pass a test that only varies the `now` option,
    // since nothing requires the implementation to read it from there.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2027-01-01T00:00:00Z'));
      const a = uidsOf(buildCalendarFeed([brevity], { baseUrl }));
      vi.setSystemTime(new Date('2027-06-01T00:00:00Z'));
      const b = uidsOf(buildCalendarFeed([brevity], { baseUrl }));
      expect(a).toEqual(b);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is derived from the row and the date kind, not a random value', () => {
    const now1 = new Date('2027-01-01T00:00:00Z');
    const now2 = new Date('2027-06-01T00:00:00Z');
    const a = uidsOf(buildCalendarFeed([brevity], { baseUrl, now: now1 }));
    const b = uidsOf(buildCalendarFeed([brevity], { baseUrl, now: now2 }));
    expect(a).toEqual(b);
  });
});

describe('buildCalendarFeed — envelope', () => {
  it('uses CRLF line endings throughout, with no bare LF', () => {
    const body = buildCalendarFeed(shows, { baseUrl });
    expect(body).toContain('\r\n');
    expect(body.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('declares VERSION:2.0 and a PRODID', () => {
    const body = buildCalendarFeed(shows, { baseUrl });
    expect(body).toContain('VERSION:2.0');
    expect(body).toMatch(/PRODID:.+/);
  });

  it('points each event URL at that show’s page', () => {
    const body = buildCalendarFeed([zenith], { baseUrl });
    expect(body).toContain(`URL:${baseUrl}/award-shows/zen`);
  });

  it('stamps DTSTAMP from the injected clock', () => {
    const now = new Date('2027-03-15T10:30:00Z');
    const body = buildCalendarFeed([zenith], { baseUrl, now });
    expect(body).toContain('DTSTAMP:20270315T103000Z');
  });
});

describe('escapeIcsText', () => {
  it('escapes backslash, comma, semicolon and newlines', () => {
    expect(escapeIcsText('a\\b,c;d\ne')).toBe('a\\\\b\\,c\\;d\\ne');
  });

  it('escapes backslashes introduced by other rules only once (order matters)', () => {
    // If comma/semicolon were escaped before backslash, the backslash that
    // escaping ',' just introduced would itself get escaped again.
    expect(escapeIcsText(',')).toBe('\\,');
  });

  it('is applied to SUMMARY, so a show name with these characters is safe', () => {
    const show: CalendarShow = {
      ...zenith,
      name: 'Best; Picture, Ever\\',
    };
    const body = buildCalendarFeed([show], { baseUrl });
    expect(body).toContain('SUMMARY:Best\\; Picture\\, Ever\\\\ Nominations');
  });
});

describe('foldIcsLine', () => {
  it('leaves a short line untouched', () => {
    expect(foldIcsLine('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('folds a line longer than 75 octets, continuation lines starting with a space', () => {
    const long = `SUMMARY:${'x'.repeat(100)}`;
    const folded = foldIcsLine(long);
    expect(folded).toContain('\r\n ');
    const rejoined = folded.replace(/\r\n /g, '');
    expect(rejoined).toBe(long);
    for (const segment of folded.split('\r\n')) {
      expect(Buffer.byteLength(segment, 'utf8')).toBeLessThanOrEqual(75);
    }
  });

  it('does not split a multi-byte UTF-8 character across the fold boundary', () => {
    // 'é' (é) is 2 octets in UTF-8; pad so the boundary lands mid-character.
    const long = `SUMMARY:${'a'.repeat(73)}éééé`;
    const folded = foldIcsLine(long);
    for (const segment of folded.split('\r\n ').join(' ').split(' ')) {
      // Re-encoding and decoding must round-trip cleanly — a split character
      // would produce a decode error or a replacement character.
      expect(Buffer.from(segment, 'utf8').toString('utf8')).toBe(segment);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});

function uidsOf(body: string): string[] {
  return [...body.matchAll(/UID:(.+)/g)].map((m) => m[1]);
}

function isoBasic(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}
