# Award show dates — finding and recording each season's schedule

**Status:** design, approved 2026-09-12
**Problem:** the twelve shows announce next season's nomination and ceremony
dates one at a time, across four months. Today each one is typed into the admin
UI by hand, from whatever announcement happened to be seen.

**Depends on:** `2026-09-12-award-entry-pipeline-design.md`. This extends the
same script and the same skill; it must land after that branch.

## What these columns actually mean

Measured from the twelve restored rows, not assumed:

| Column | Holds |
|---|---|
| `nom_date` / `awards_date` | UTC midnight of the **event's local calendar day** |
| `nom_time` / `awards_time` | Milliseconds from that midnight to the real instant |
| duration | Length of the calendar block; null falls back to 30 minutes |

The instant is the **sum**, and that is the only thing anything reads —
`lib/services/ical.ts` computes `start = date + (time ?? 0)`.

The split matters anyway, because it is how a ceremony keeps the right calendar
day. An 8:00 PM ET ceremony on 15 March is `01:30Z` on the **16th**, so the time
column carries **more than 24 hours** — Oscars stores 91,800,000 ms (25.5 h)
against a date of `2026-03-15T00:00Z`. Every restored row follows this and every
one lands on a round ET time:

```
afi     noms  2025-12-04T13:00Z  =  8:00 AM ET
gg      noms  2025-12-08T13:00Z  =  8:00 AM ET      show 2026-01-12T01:00Z = 8:00 PM ET, Jan 11
oscars  noms  2026-01-22T13:00Z  =  8:00 AM ET      show 2026-03-16T01:30Z = 9:30 PM ET, Mar 15
sag     noms  2026-01-07T15:00Z  = 10:00 AM ET      show 2026-03-02T01:00Z = 8:00 PM ET, Mar 1
wga     noms  2026-01-27T16:00Z  = 11:00 AM ET
```

The data already handles daylight saving correctly — January ceremonies convert
at UTC−5 and March ceremonies at UTC−4 — so any conversion this feature writes
must too. That is the one genuinely difficult part of this work and it gets real
tests.

🔴 `components/EventAdmin.tsx` splits on the **browser's** local midnight rather
than the event's. The sum it writes is still correct, so nothing is broken
today; it simply produces a different split than the restored data. This feature
matches the restored convention, and does not change `EventAdmin`.

## Decisions

| Question | Answer |
|---|---|
| A source gives a date but no time | **Reuse that show's existing time.** They are stable year over year — SAG announces at 10:00 ET, WGA at 11:00, most at 8:00. Fall back to 8:00 AM ET for nominations and 8:00 PM ET for a ceremony only when the row has no prior value, and say so in the report. |
| Durations | **Never written.** Nothing announces one, the existing values are right, and 30 minutes is correct for an announcement livestream. |
| A show has not announced yet | **Leave the old value and flag it.** Never overwrite with a guess, never null a column. The report lists what is still outstanding so a later re-run can pick it up. |
| Scope | All twelve in one run, **skipping any show that already has a date for this season** — so a re-run in December only researches what December has newly announced. `--recheck <abbr>` forces one show to be looked at again, for when an announced date moves. |
| AFI | Has a nominations date and **no ceremony** — it names ten films and declares no winners. Its missing `awards_date` is correct, not outstanding. |
| Notifications | None. A schedule change is not something to page every member about. |

### "Already has a date for this season"

A date belongs to season *Y* when it falls in **1 August *Y*−1 → 31 July *Y***,
UTC. The 2026 season's real dates run from AFI's nominations on 4 December 2025
to the Oscars on 15 March 2026, so the window has months of margin at both ends
and cannot be confused with an adjacent season.

Nominations and ceremony are judged **separately**: a show whose nominations
date is current but whose ceremony date is still last season's gets researched
for the ceremony only.

## Components

### 1. `scripts/award-import.mjs` — two new subcommands

Both follow the existing convention: read-only unless `--commit`, and
`DATABASE_URL` always passed explicitly.

#### `dates [--recheck <abbr>]`

Read-only. Prints, for all twelve shows: the current nomination and ceremony
instants rendered in ET, whether each falls in the active season's window, and
the time-of-day to reuse if the source gives only a date. Shows already current
for both are marked `skip`.

This is what the skill reads **before** searching, so it knows which shows to
research and what time to assume.

#### `set-dates <plan.json> [--commit]`

Converts each entry to the `(date, time)` split and writes it. It:

1. Refuses a plan whose `year` is not the active season.
2. Refuses an abbreviation that is not a real show.
3. Refuses a date outside the season window — the same class of error the
   nominations pipeline's year check exists for, and the same answer: refuse
   rather than write a plausible wrong season.
4. Skips a show already current for that field unless the plan sets
   `"recheck": true` on it, and says which it skipped.
5. Writes only the columns present in the plan. A missing `awards` entry writes
   nothing to the ceremony columns — it does not null them.
6. Writes all changes in one transaction, then revalidates each changed show.

Dry run prints a per-row `current → proposed` table with the ET rendering of
both, so what is about to change is legible without arithmetic.

### 2. The plan file

`.local/award-plans/dates-<year>.json`. Dates are written as a **local date,
local time and IANA zone** — never epoch milliseconds. The script does the
conversion, which is the whole point of having one.

```jsonc
{
  "kind": "dates",
  "year": 2026,
  "sources": ["https://…"],
  "shows": [
    {
      "abbreviation": "dga",
      "nominations": { "date": "2026-01-08", "time": "08:00", "tz": "America/New_York" },
      "awards":       { "date": "2026-02-07", "time": "20:00", "tz": "America/New_York" }
    },
    {
      "abbreviation": "afi",
      "nominations": { "date": "2025-12-04", "tz": "America/New_York" }
    }
  ]
}
```

`time` omitted means "reuse this show's existing time", per the decision above.
`tz` defaults to `America/New_York` — every one of these shows announces on ET,
BAFTA included, whose London ceremony the restored data already stores as an ET
instant like the rest.

### 3. `.claude/skills/award-entry/SKILL.md` — a fourth mode

Invoked as "update the award show dates" or "when are the Oscars this year".
The procedure:

1. `dates` — read what is already current. Research only what it lists.
2. Search for each outstanding show's announcement. Prefer the organisation's
   own press release over an aggregator; record every URL.
3. Build the plan. A show that has genuinely not announced yet is **left out of
   the plan entirely**, not guessed.
4. `set-dates --dry-run`, show the owner the `current → proposed` table.
5. Stop for approval.
6. `set-dates --commit`.

## Scores and caching

Nothing here touches scoring. These columns feed the show page's schedule and
the public iCal feed (`app/api/ical/[...slug]/route.ts`), so `set-dates --commit`
revalidates each changed show through the existing `/api/revalidate` — the same
reason the nominations pipeline does, and the same endpoint.

There is no title verification step here: `refresh`'s check confirms nominees
render, which is not what changed. `set-dates` reuses only the revalidation
half, extracted as a shared helper so there is one place that posts to that
route.

## Testing

The conversion is the risk, so it carries the tests:

- 8:00 AM ET in January → `13:00Z`, split as UTC-midnight + 13 h
- 8:00 PM ET on 11 January → `01:00Z` on the 12th, split as the **11th's**
  midnight + 25 h — the >24 h case
- 9:30 PM ET on 15 March 2026 → `01:30Z` on the 16th at 25.5 h, which is inside
  US daylight saving and must convert at UTC−4, not UTC−5
- round-trip: every one of the twelve restored rows, converted back from its
  stored split, renders the ET time it was recorded as
- season window: a date one day inside each edge passes, one day outside is
  refused
- a plan omitting `awards` leaves both ceremony columns untouched

## Out of scope

- Changing `EventAdmin`'s split convention.
- Writing durations.
- Any per-season history of dates. The schema holds one row per show, so a
  previous season's dates are overwritten — as they already are today.
