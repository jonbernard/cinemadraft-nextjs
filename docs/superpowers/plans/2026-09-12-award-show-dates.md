# Award Show Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner say "update the award show dates" and have the skill research only the shows that have newly announced, propose a `current → proposed` table for approval, and write each season's nomination and ceremony schedule.

**Architecture:** Two new subcommands on the existing `scripts/award-import.mjs` — `dates` (read-only report) and `set-dates` (writes). The plan file carries a local date, a local time and an IANA zone; the script does every conversion, because the split these columns use is the thing most likely to be got wrong by hand.

**Tech Stack:** Node 24 ESM, `pg`, `Intl.DateTimeFormat` for zone conversion (no new dependency), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-award-show-dates-design.md`

**Prerequisite:** the award-entry pipeline branch must be merged first — this extends the same script and skill file. Do not start until `scripts/award-import.mjs` contains `connect`, `loadContext`, `revalidateShow`-or-`refresh`, and `.claude/skills/award-entry/SKILL.md` exists.

## Global Constraints

- **Biome, not ESLint/Prettier.** `npm run lint` covers lint, format and import order; `npm run typecheck` is separate. Add no new warnings — the repo has 28 pre-existing ones in unrelated files.
- **No new dependencies.** Zone conversion uses `Intl.DateTimeFormat`, which Node 24 ships with full ICU.
- **`scripts/*.test.mjs` must never import `@/lib/db` or open a connection.** The DB client is passed in.
- **Production is reached only by an explicit `DATABASE_URL` on the command line.** The script loads no `.env` file.
- **Every subcommand is read-only unless `--commit` is passed.**
- **The instant is `date + time`.** `date` is UTC midnight of the event's **local calendar day**; `time` is the remainder and **may exceed 24 hours** for an evening ceremony.
- **Durations are never written.** Not by any code in this plan.
- **A column is never nulled.** A show that has not announced is left alone and reported.
- Commit messages end with a blank line then: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

### Task 1: Zone conversion and the season window

The pure core. This is where the risk lives: an evening ceremony's time column exceeds 24 hours, and March ceremonies fall inside US daylight saving while January ones do not.

**Files:**
- Modify: `scripts/award-import.mjs`
- Modify: `scripts/award-import.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `zoneOffsetMs(instantMs: number, tz: string): number` — the zone's offset from UTC at that instant, positive east.
  - `toInstant({date: string, time: string, tz: string}): number` — a local wall-clock time in a zone → epoch ms.
  - `toDateTimeSplit({date, time, tz}): {date: number, time: number}` — the two columns.
  - `seasonWindow(year: number): {start: number, end: number}`
  - `isInSeason(instantMs: number | null, year: number): boolean`
  - `formatEt(instantMs: number | null): string` — for the report's human column.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/award-import.test.mjs`:

```javascript
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
    expect(() => toDateTimeSplit({ date: 'January 22nd', time: '08:00', tz: ET })).toThrow(
      /date/,
    );
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: FAIL — `toDateTimeSplit is not a function`.

- [ ] **Step 3: Implement**

Append to `scripts/award-import.mjs`:

```javascript
const ET = 'America/New_York';
const HOUR = 3600000;
const DAY = 86400000;

/**
 * A zone's offset from UTC at a given instant, in milliseconds, positive east.
 *
 * 🔴 Derived from `Intl`, not from a table. The alternative — assuming ET is
 * UTC−5 — is wrong for every ceremony held after US daylight saving begins in
 * March, which is the Oscars every year.
 *
 * `formatToParts` with `timeZone` gives the wall-clock reading in that zone;
 * re-reading it as if it were UTC and subtracting gives the offset.
 */
export function zoneOffsetMs(instantMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instantMs));

  const at = (type) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour'),
    at('minute'),
    at('second'),
  );
  return asUtc - instantMs;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/**
 * A wall-clock time in a zone → the epoch instant it names.
 *
 * Two passes, not one: the offset depends on the instant, and the instant is
 * what is being solved for. The first pass uses the offset at the naive
 * reading; the second corrects it if that reading fell on the far side of a
 * daylight-saving transition.
 */
export function toInstant({ date, time, tz = ET }) {
  if (!DATE_PATTERN.test(date ?? '')) {
    throw new Error(`date must be YYYY-MM-DD, got "${date}"`);
  }
  if (!TIME_PATTERN.test(time ?? '')) {
    throw new Error(`time must be HH:MM, got "${time}"`);
  }

  const naive = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(naive)) throw new Error(`date "${date}" and time "${time}" are not real`);

  const first = naive - zoneOffsetMs(naive, tz);
  return naive - zoneOffsetMs(first, tz);
}

/**
 * The two columns `events` actually stores.
 *
 * 🔴 `date` is UTC midnight of the event's **local** calendar day, and `time`
 * is everything else — which for an evening ceremony is more than 24 hours.
 * An 8pm ET ceremony on 11 January is 01:00Z on the 12th; storing the 12th
 * would move it a day in the calendar feed and on the show page. Every
 * restored row follows this, and the round-trip tests pin all twelve.
 */
export function toDateTimeSplit({ date, time, tz = ET }) {
  const instant = toInstant({ date, time, tz });
  const midnight = Date.parse(`${date}T00:00:00Z`);
  return { date: midnight, time: instant - midnight };
}

/**
 * When a season's dates live: 1 August of the prior year to 31 July.
 *
 * The 2026 season really runs from AFI's nominations on 4 December 2025 to the
 * Oscars on 15 March 2026, so this has months of margin at both ends and
 * cannot be confused with an adjacent season.
 */
export function seasonWindow(year) {
  return {
    start: Date.parse(`${year - 1}-08-01T00:00:00Z`),
    end: Date.parse(`${year}-07-31T23:59:59.999Z`),
  };
}

/** Is this instant part of that season? A null never is. */
export function isInSeason(instantMs, year) {
  if (instantMs == null) return false;
  const { start, end } = seasonWindow(year);
  return instantMs >= start && instantMs <= end;
}

/** An instant as a person reads it, for the report. */
export function formatEt(instantMs) {
  if (instantMs == null) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(instantMs));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: PASS — the whole file, including the 10 round-trip cases.

- [ ] **Step 5: Mutation-check the daylight-saving correction**

Replace the two-pass body of `toInstant` with the single pass — `return naive - zoneOffsetMs(naive, tz);` — and re-run. Expected: the suite goes RED on at least one March case. Restore and confirm green.

Then replace `toDateTimeSplit`'s `midnight` with `instant - (instant % DAY)` (UTC-truncating the instant instead of using the local day) and re-run. Expected: RED on the evening-ceremony cases. Restore and confirm green.

If either mutation leaves the suite green, the tests do not pin the behaviour — say so and add the case that does.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add scripts/award-import.mjs scripts/award-import.test.mjs
git commit -m "feat(scripts): zone conversion and the season window for award show dates

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `dates` — the read-only report

**Files:**
- Modify: `scripts/award-import.mjs`

**Interfaces:**
- Consumes: `connect` (existing), `isInSeason`, `formatEt` from Task 1.
- Produces:
  - `loadDates(client): Promise<{activeYear: number, shows: ShowDates[]}>` where `ShowDates` is
    `{id, abbreviation, name, nomDate, nomTime, awardsDate, awardsTime, nomInstant, awardsInstant, nomCurrent, awardsCurrent, nomTimeOfDay, awardsTimeOfDay}`
  - CLI: `node scripts/award-import.mjs dates`

- [ ] **Step 1: Implement the loader**

Append to `scripts/award-import.mjs`:

```javascript
/**
 * Every show's schedule, and whether each half is already current.
 *
 * 🔴 Nominations and ceremony are judged separately. A show routinely
 * announces its nominations date months before its ceremony date, so treating
 * the show as one unit would either re-research what is already known or skip
 * what is still missing.
 */
export async function loadDates(client) {
  const active = await client.query(
    'SELECT year FROM available_years WHERE is_active = true LIMIT 1',
  );
  const newest = await client.query(
    'SELECT year FROM available_years ORDER BY year DESC LIMIT 1',
  );
  const activeYear = active.rows[0]?.year ?? newest.rows[0]?.year;
  if (activeYear == null) throw new Error('no seasons exist in available_years');

  const rows = await client.query(
    `SELECT id, abbreviation, name, nom_date, nom_time, awards_date, awards_time
       FROM events
      ORDER BY abbreviation`,
  );

  const shows = rows.rows.map((row) => {
    const nomDate = row.nom_date == null ? null : Number(row.nom_date);
    const nomTime = row.nom_time == null ? null : Number(row.nom_time);
    const awardsDate = row.awards_date == null ? null : Number(row.awards_date);
    const awardsTime = row.awards_time == null ? null : Number(row.awards_time);

    const nomInstant = nomDate == null ? null : nomDate + (nomTime ?? 0);
    const awardsInstant = awardsDate == null ? null : awardsDate + (awardsTime ?? 0);

    return {
      id: row.id,
      abbreviation: row.abbreviation,
      name: row.name,
      nomDate,
      nomTime,
      awardsDate,
      awardsTime,
      nomInstant,
      awardsInstant,
      nomCurrent: isInSeason(nomInstant, activeYear),
      awardsCurrent: isInSeason(awardsInstant, activeYear),
      // What to reuse when a source gives a date but no time. These are stable
      // per show — SAG announces at 10:00 ET, WGA at 11:00, most at 8:00.
      nomTimeOfDay: nomTime,
      awardsTimeOfDay: awardsTime,
    };
  });

  return { activeYear, shows };
}
```

- [ ] **Step 2: Add the `dates` branch to `main()`**

Inside `main()`, alongside the other command branches:

```javascript
  if (command === 'dates') {
    const client = await connect();
    try {
      const { activeYear, shows } = await loadDates(client);
      console.log(`active season: ${activeYear}\n`);
      for (const show of shows) {
        const needs = [];
        if (!show.nomCurrent) needs.push('nominations');
        if (!show.awardsCurrent) needs.push('ceremony');
        console.log(
          `${show.abbreviation.padEnd(7)} ${needs.length === 0 ? 'skip  ' : 'RESEARCH'} ${show.name}`,
        );
        console.log(
          `        nominations ${formatEt(show.nomInstant).padEnd(28)} ${show.nomCurrent ? 'current' : 'not this season'}`,
        );
        console.log(
          `        ceremony    ${formatEt(show.awardsInstant).padEnd(28)} ${show.awardsCurrent ? 'current' : 'not this season'}`,
        );
      }
      const outstanding = shows.filter((show) => !show.nomCurrent || !show.awardsCurrent);
      console.log(
        `\n${outstanding.length} of ${shows.length} shows need research: ` +
          outstanding.map((show) => show.abbreviation).join(', '),
      );
    } finally {
      await client.end();
    }
  }
```

- [ ] **Step 3: Verify against the local database**

```bash
npm run db:up
DATABASE_URL='postgresql://cinemadraft:local@localhost:5433/cinemadraft' \
  node scripts/award-import.mjs dates
```

Expected, against the restored data: twelve shows, the active season printed,
and every instant rendering at a round ET time — `8:00 AM EST` for most
nominations, `10:00 AM` for SAG, `11:00 AM` for WGA, `8:00 PM` for ceremonies,
`9:30 PM` for the Oscars. **AFI's ceremony line must read `—` / `not this
season`**, which is correct: AFI names ten films and declares no winners.

If any instant renders at an odd time — `3:00 AM`, say — the conversion or the
sum is wrong; stop and report it rather than continuing.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint
git add scripts/award-import.mjs
git commit -m "feat(scripts): award-import dates — report each show's schedule and what needs research

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `set-dates` — validate and write

**Files:**
- Modify: `scripts/award-import.mjs`
- Modify: `scripts/award-import.test.mjs`

**Interfaces:**
- Consumes: `loadDates`, `toDateTimeSplit`, `isInSeason`, `formatEt`, `connect`.
- Produces:
  - `validateDatesPlan(plan, shows): string[]`
  - `applyDates(client, plan, state, {commit}): Promise<{changes: Change[], skipped: {abbreviation, field, reason}[]}>` where `Change` is `{abbreviation, field, fromInstant, toInstant, date, time}`
  - CLI: `node scripts/award-import.mjs set-dates <plan.json> [--commit]`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/award-import.test.mjs`:

```javascript
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
    return { ran, async query(text, params) { ran.push({ text, params }); return { rows: [] }; } };
  }

  it('writes nothing without --commit', async () => {
    const client = fakeDbClient();
    const report = await applyDates(client, PLAN, STATE, { commit: false });
    expect(report.changes).toHaveLength(2);
    expect(client.ran.some((call) => /UPDATE events/.test(call.text))).toBe(false);
  });

  it('writes the split, not the instant', async () => {
    const client = fakeDbClient();
    await applyDates(client, PLAN, STATE, { commit: true });
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
    await expect(applyDates(client, bad, STATE, { commit: true })).rejects.toThrow(
      /outside the 2026 season/,
    );
    expect(client.ran.some((call) => /UPDATE events/.test(call.text))).toBe(false);
  });

  it('refuses a plan year that is not the active season', async () => {
    const client = fakeDbClient();
    await expect(
      applyDates(client, { ...PLAN, year: 2025 }, STATE, { commit: true }),
    ).rejects.toThrow(/not the active season/);
    expect(client.ran).toHaveLength(0);
  });

  // The owner's rule: a re-run only researches and writes what is new.
  it('skips a field that is already current for this season', async () => {
    const client = fakeDbClient();
    const current = {
      activeYear: 2026,
      shows: [{ ...SHOWS[0], nomCurrent: true, nomInstant: Date.parse('2026-01-08T13:00:00Z') }],
    };
    const report = await applyDates(client, PLAN, current, { commit: true });
    expect(report.changes.map((change) => change.field)).toEqual(['awards']);
    expect(report.skipped[0]).toMatchObject({ abbreviation: 'dga', field: 'nominations' });
  });

  it('writes a skipped field anyway when the entry sets recheck', async () => {
    const client = fakeDbClient();
    const current = {
      activeYear: 2026,
      shows: [{ ...SHOWS[0], nomCurrent: true, nomInstant: Date.parse('2026-01-08T13:00:00Z') }],
    };
    const plan = { ...PLAN, shows: [{ ...PLAN.shows[0], recheck: true }] };
    const report = await applyDates(client, plan, current, { commit: true });
    expect(report.changes.map((change) => change.field)).toEqual(['nominations', 'awards']);
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
    await applyDates(client, plan, STATE, { commit: true });
    expect(client.ran.some((call) => /awards_date/.test(call.text))).toBe(false);
  });

  // A source giving only a date is the common case.
  it('reuses the show existing time when the entry omits one', async () => {
    const client = fakeDbClient();
    const plan = {
      ...PLAN,
      shows: [{ abbreviation: 'dga', nominations: { date: '2026-01-08' } }],
    };
    await applyDates(client, plan, STATE, { commit: true });
    const update = client.ran.find((call) => /nom_date/.test(call.text));
    expect(update.params).toContain(46800000);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: FAIL — `validateDatesPlan is not a function`.

- [ ] **Step 3: Implement**

Append to `scripts/award-import.mjs`:

```javascript
/** Default announcement times, used only when a show has no prior value. */
const DEFAULT_NOM_TIME = '08:00';
const DEFAULT_AWARDS_TIME = '20:00';

/** Every problem with a dates plan, as sentences. Empty means it may be applied. */
export function validateDatesPlan(plan, shows) {
  const problems = [];
  const known = new Set(shows.map((show) => show.abbreviation.toLowerCase()));

  if (plan.kind !== 'dates') problems.push('kind must be "dates"');
  if (!Number.isSafeInteger(plan.year) || plan.year <= 0) {
    problems.push('year must be a positive integer');
  }
  if (!Array.isArray(plan.sources) || plan.sources.length === 0) {
    problems.push('the plan records no source URL');
  }

  for (const entry of plan.shows ?? []) {
    const abbreviation = (entry.abbreviation ?? '').toLowerCase();
    if (!known.has(abbreviation)) {
      problems.push(`"${entry.abbreviation}" is not a show`);
      continue;
    }
    if (entry.nominations == null && entry.awards == null) {
      problems.push(
        `${entry.abbreviation} names neither a nominations date nor an awards date`,
      );
    }
  }

  return problems;
}

/**
 * Write each season's schedule.
 *
 * 🔴 Everything that can refuse does so before the first UPDATE, so a refusal
 * never leaves half a season's calendar entered.
 *
 * 🔴 A field already current for this season is skipped rather than rewritten,
 * which is what makes this safe to re-run monthly as shows announce. `recheck`
 * on an entry overrides that, for a date that has moved.
 *
 * 🔴 A column is never nulled. An entry that omits `awards` leaves both
 * ceremony columns exactly as they were — a show that has not announced keeps
 * last season's value and is reported, rather than losing it.
 */
export async function applyDates(client, plan, state, { commit }) {
  const problems = validateDatesPlan(plan, state.shows);
  if (problems.length > 0) {
    throw new Error(`this plan cannot be applied:\n  - ${problems.join('\n  - ')}`);
  }

  if (plan.year !== state.activeYear) {
    throw new Error(
      `plan year ${plan.year} is not the active season ${state.activeYear} — ` +
        'fix the plan, or change the active season first',
    );
  }

  const byAbbreviation = new Map(
    state.shows.map((show) => [show.abbreviation.toLowerCase(), show]),
  );
  const changes = [];
  const skipped = [];

  for (const entry of plan.shows) {
    const show = byAbbreviation.get(entry.abbreviation.toLowerCase());

    for (const field of ['nominations', 'awards']) {
      const given = entry[field];
      if (given == null) continue;

      const isNominations = field === 'nominations';
      const alreadyCurrent = isNominations ? show.nomCurrent : show.awardsCurrent;
      if (alreadyCurrent && entry.recheck !== true) {
        skipped.push({
          abbreviation: show.abbreviation,
          field,
          reason: `already set for the ${state.activeYear} season`,
        });
        continue;
      }

      const existingTime = isNominations ? show.nomTimeOfDay : show.awardsTimeOfDay;
      const time =
        given.time ??
        (existingTime == null
          ? isNominations
            ? DEFAULT_NOM_TIME
            : DEFAULT_AWARDS_TIME
          : msToHhmm(existingTime));

      const split = toDateTimeSplit({ date: given.date, time, tz: given.tz ?? ET });
      const instant = split.date + split.time;

      if (!isInSeason(instant, state.activeYear)) {
        throw new Error(
          `${show.abbreviation} ${field} ${formatEt(instant)} is outside the ` +
            `${state.activeYear} season — this is usually the wrong year's announcement`,
        );
      }

      changes.push({
        abbreviation: show.abbreviation,
        id: show.id,
        field,
        fromInstant: isNominations ? show.nomInstant : show.awardsInstant,
        toInstant: instant,
        date: split.date,
        time: split.time,
      });
    }
  }

  if (!commit) return { changes, skipped };

  await client.query('BEGIN');
  try {
    for (const change of changes) {
      const columns =
        change.field === 'nominations'
          ? 'nom_date = $1, nom_time = $2'
          : 'awards_date = $1, awards_time = $2';
      await client.query(
        `UPDATE events SET ${columns}, updated_at = now() WHERE id = $3`,
        [change.date, change.time, change.id],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return { changes, skipped };
}

/**
 * A stored time-of-day back into `HH:MM`, so a reused time round-trips through
 * the same conversion a fresh one does.
 *
 * Takes the remainder past a whole day first: an evening ceremony's stored
 * time exceeds 24 hours, and `25:00` is not a wall clock.
 */
export function msToHhmm(ms) {
  const withinDay = ((ms % DAY) + DAY) % DAY;
  const hours = Math.floor(withinDay / HOUR);
  const minutes = Math.floor((withinDay % HOUR) / 60000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Wire `set-dates` into `main()`**

```javascript
  if (command === 'set-dates') {
    const planPath = rest.find((arg) => !arg.startsWith('--'));
    const commit = rest.includes('--commit');
    const { readFileSync } = await import('node:fs');
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));

    const client = await connect();
    try {
      const state = await loadDates(client);
      const report = await applyDates(client, plan, state, { commit });

      console.log(commit ? 'WROTE:' : 'DRY RUN — nothing written:');
      for (const change of report.changes) {
        console.log(
          `  ${change.abbreviation.padEnd(7)} ${change.field.padEnd(12)} ` +
            `${formatEt(change.fromInstant)}  →  ${formatEt(change.toInstant)}`,
        );
      }
      for (const skip of report.skipped) {
        console.log(`  = ${skip.abbreviation} ${skip.field} (${skip.reason})`);
      }
      console.log(
        `${report.changes.length} to change, ${report.skipped.length} skipped` +
          (commit ? '' : ' — re-run with --commit to write'),
      );

      if (commit && report.changes.length > 0) {
        const secret = process.env.REVALIDATE_SECRET ?? null;
        if (!secret) {
          console.error(
            'REVALIDATE_SECRET is not set — the dates are written but no cache was cleared',
          );
          process.exitCode = 1;
        } else {
          const baseUrl = process.env.SITE_URL ?? 'https://cinemadraft.com';
          for (const abbreviation of new Set(
            report.changes.map((change) => change.abbreviation.toLowerCase()),
          )) {
            const posted = await fetch(`${baseUrl}/api/revalidate`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ secret, abbreviation }),
            });
            console.log(
              `  revalidate ${abbreviation}: ${posted.ok ? 'ok' : `FAILED ${posted.status}`}`,
            );
            if (!posted.ok) process.exitCode = 1;
          }
        }
      }
    } finally {
      await client.end();
    }
  }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run scripts/award-import.test.mjs`
Expected: PASS, the whole file.

- [ ] **Step 6: Mutation-check the two guards that matter**

For each, break it, re-run, confirm RED, restore, confirm GREEN — and quote the failure line:

1. The season-window refusal — change `if (!isInSeason(...))` to `if (false)`. The "refuses a date outside the season window" test must fail.
2. The never-null rule — make the UPDATE always write both column pairs regardless of which fields the entry names. The "leaves the ceremony columns untouched" test must fail.

If either stays green, the test does not pin the behaviour: say so and add the case that does.

- [ ] **Step 7: Dry run against the local database**

```bash
DATABASE_URL='postgresql://cinemadraft:local@localhost:5433/cinemadraft' \
  node scripts/award-import.mjs dates
```

Take a real abbreviation whose ceremony is not current, write a plan naming a
plausible in-season date for it, then:

```bash
DATABASE_URL='postgresql://cinemadraft:local@localhost:5433/cinemadraft' \
  node scripts/award-import.mjs set-dates /tmp/dates-plan.json
```

Expected: a `current → proposed` table with both sides rendered in ET, and
`SELECT nom_date, awards_date FROM events WHERE abbreviation = '<abbr>'`
unchanged. Record both readings.

- [ ] **Step 8: Lint and commit**

```bash
npm run lint
git add scripts/award-import.mjs scripts/award-import.test.mjs
git commit -m "feat(scripts): award-import set-dates — write each season's schedule, skipping what is current

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The skill's fourth mode

**Files:**
- Modify: `.claude/skills/award-entry/SKILL.md`

**Interfaces:**
- Consumes: `dates` and `set-dates` from Tasks 2–3.
- Produces: the invocation surface — "update the award show dates", "when are the Oscars this year".

- [ ] **Step 1: Add the mode to the skill's mode table**

Add a row to the table at the top of `.claude/skills/award-entry/SKILL.md`:

```markdown
| "update the award show dates" | dates — research each season's schedule and record it |
```

- [ ] **Step 2: Add the section**

Add before the `## Never` section:

```markdown
## Dates

The twelve shows announce next season's schedule one at a time across about
four months, so this is run every few weeks from autumn onward and only ever
looks at what is still outstanding.

1. **Read what is already known.** This decides what to research:

   ```bash
   DATABASE_URL="$PROD" node scripts/award-import.mjs dates
   ```

   Every show is marked `skip` or `RESEARCH`, per half. A show whose
   nominations date is current but whose ceremony is not gets researched for
   the ceremony only.

2. **Search for each outstanding show.** Prefer the organisation's own press
   release over an aggregator — aggregators repeat last year's date more often
   than they report this year's. Record every URL in `sources`.

3. **Write the plan** to `.local/award-plans/dates-<year>.json`:

   ```json
   {
     "kind": "dates",
     "year": 2026,
     "sources": ["https://…"],
     "shows": [
       {
         "abbreviation": "dga",
         "nominations": { "date": "2026-01-08", "time": "08:00" },
         "awards": { "date": "2026-02-07", "time": "20:00" }
       }
     ]
   }
   ```

   - `time` is `HH:MM` in the show's local zone, 24-hour. Omit it and the show's
     existing time is reused, which is almost always right — these hold steady
     year over year.
   - `tz` defaults to `America/New_York`. Only set it if a show genuinely
     announces on another clock.
   - **A show that has not announced is left out of the plan entirely.** Never
     guess a date from last year's, and never write "mid-January".

4. **Dry run**, and show the owner the `current → proposed` table:

   ```bash
   DATABASE_URL="$PROD" node scripts/award-import.mjs set-dates .local/award-plans/dates-2026.json
   ```

5. **STOP. Wait for approval.**

6. **Commit:**

   ```bash
   DATABASE_URL="$PROD" REVALIDATE_SECRET="…" \
     node scripts/award-import.mjs set-dates .local/award-plans/dates-2026.json --commit
   ```

   This revalidates each changed show itself — the dates feed the public
   calendar feed at `/api/ical`, not just the show page.

### What to know about the shows

- **AFI has no ceremony.** It names ten films and declares no winners, so its
  `awards` half is permanently blank. That is correct — never invent one, and
  do not report it as outstanding.
- **A date that moves.** If a show reschedules, its date is already "current"
  and will be skipped. Set `"recheck": true` on that show's entry to write it
  anyway.
- **Ceremonies are evening events**, so their stored time exceeds 24 hours —
  an 8pm ET show on the 11th is 01:00Z on the 12th but belongs on the 11th.
  The script handles this; do not try to pre-compute it in the plan.
```

- [ ] **Step 3: Add the never**

Append to the `## Never` list:

```markdown
- Never guess an unannounced date from last season's, and never null a date
  that is merely stale — leave it and report it.
- Never write durations. Nothing announces one and the existing values are right.
```

- [ ] **Step 4: Verify the skill still parses**

Confirm the YAML frontmatter is intact and `name:` is still exactly
`award-entry`. Confirm the mode table has four rows and every command named in
the file exists in `scripts/award-import.mjs`:

```bash
grep -o "award-import.mjs [a-z-]*" .claude/skills/award-entry/SKILL.md | sort -u
```
Expected: only `context`, `apply`, `finish`, `refresh`, `dates`, `set-dates`.

- [ ] **Step 5: Full verification and commit**

```bash
npm run verify
git add .claude/skills/award-entry/SKILL.md
git commit -m "feat(skills): award-entry gains a dates mode

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage**

| Spec section | Task |
|---|---|
| The column convention (date + time, >24h) | 1 |
| Daylight saving | 1 |
| Season window / "already current" | 1 (rule), 3 (enforced) |
| `dates` report | 2 |
| `set-dates` | 3 |
| Plan file shape | 3 (consumed), 4 (documented) |
| Reuse the existing time | 3 (`msToHhmm` + default) |
| Never write durations | Enforced by omission — no task writes those columns; asserted in Task 3's never-null test and stated in Task 4 |
| Never null a column | 3 |
| AFI has no ceremony | 4 (skill knowledge, not hardcoded in the script) |
| Revalidation | 3 |
| Skill mode | 4 |

**Known deviation from the spec, accepted:** the spec proposes extracting a
shared `revalidateShow` helper from `refresh`. Task 3 inlines the POST in the
`set-dates` branch instead — `refresh` also verifies rendered titles, which
`set-dates` must not do, so the shared part is four lines and extracting it
would couple two commands that refuse for different reasons. If a third caller
ever appears, extract it then.

**Type consistency:** `loadDates` returns `{activeYear, shows}` and `applyDates`
takes that whole object as `state` — the tests construct it in that shape.
`change.field` is the string `'nominations'` or `'awards'`, matching the plan
file's keys, and is what selects the column pair in the UPDATE.
