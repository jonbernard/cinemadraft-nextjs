---
name: award-entry
description: Use when entering an award show's nominations or winners — "DGA nominations", "Oscars winners", "run the SAG show live", "update the award show dates", "when are the Oscars this year". Researches the listing, proposes every nomination (or date) for approval, writes to production, clears the cache, and broadcasts one notification.
---

# Entering an award show

Four modes, one procedure. Mode comes from the ask:

| Ask | Mode |
|---|---|
| "DGA nominations" | nominations — research a listing, enter every category |
| "Oscars winners" | winners — one listing, every category at once |
| "run the Oscars live" | live — one category at a time, as they are announced |
| "update the award show dates" | dates — research each season's schedule and record it |

## One-time setup

Two environment values, needed once per machine. Everything else works from the
checkout.

**`REVALIDATE_SECRET`** — the shared secret for `/api/revalidate`. Without it
`refresh` refuses to run rather than skipping the cache clear silently, so
nothing in this skill works end to end until it is set. Generate one, put it in
`.env.local` (gitignored), and set the *same value* on Vercel:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
# → paste it into .env.local as REVALIDATE_SECRET=…
vercel env add REVALIDATE_SECRET production
```

The local copy and the Vercel copy must match: the script reads the local one
and posts it to the deployed route, which compares it against its own. A
mismatch answers 404 — deliberately indistinguishable from the route not
existing — so if `refresh` reports 404 with a secret set, they have drifted.

**`TMDB_API_KEY`** — already in `.env.local` for normal development. `apply`
needs it only to ingest a film the app has never cached, which is the common
case in January.

Redeploy after adding the Vercel variable; an existing deployment does not pick
it up.

## Before anything else

```bash
export PROD="$(grep -m1 '^DATABASE_URL' .env.neon | cut -d= -f2- | tr -d '\"')"
DATABASE_URL="$PROD" node scripts/award-import.mjs context <ABBR>
```

This prints the show, its real category names and award ids, the active season,
what is already entered, and the release years of this season's draft picks.

**Read it before searching the web.** Category headings come from the `awards`
rows, never from the article. If the abbreviation is unknown the command lists
every show — ask which one.

## Nominations

1. **Search** for the announcement. Prefer one page listing every category.
   Record every URL you used.
2. **Map** each heading in the article to an `awards.id` from `context`. A
   heading with no matching award goes in the plan's `unmatched` array. Never
   file a nomination under a near-miss category — a wrong category pays that
   category's points and the page renders it without a hint anything is wrong.
3. **Find each film on TMDB** and put its id in `tmdbId`. For a category with
   `requiresNomineeName: true`, `detailName` is the person; it is required and
   `apply` refuses without it. `detailId` is optional; include it only when
   you have the person's id.

   **One film can appear twice in one category** — 2026 Best Supporting Actor
   had *One Battle After Another* for both Benicio del Toro and Sean Penn. List
   it once per person. `apply` skips a nominee only if the same film **and the
   same person** is already entered (or already earlier in the plan). Same
   person means the same `detailId` when both rows have one, otherwise the same
   `detailName` ignoring case and surrounding spaces. A second person on the
   same film is a new nomination.
4. **Write the plan** to `.local/award-plans/<abbr>-<year>-nominations.json`
   (gitignored; it names films before the site does):

   ```json
   {
     "kind": "nominations",
     "eventAbbreviation": "DGA",
     "year": 2025,
     "sources": ["https://…"],
     "unmatched": [],
     "categories": [
       {
         "awardId": 42,
         "awardName": "Outstanding Directorial Achievement in Theatrical Feature Film",
         "nominees": [
           { "title": "One Battle After Another", "tmdbId": "1234567", "detailName": "Paul Thomas Anderson" }
         ]
       }
     ]
   }
   ```

5. **Dry run**, and show the owner the output plus anything unmatched:

   ```bash
   DATABASE_URL="$PROD" TMDB_API_KEY="$(grep -m1 '^TMDB_API_KEY' .env.local | cut -d= -f2-)" \
     node scripts/award-import.mjs apply .local/award-plans/<file>.json
   ```

6. **STOP. Wait for approval.** Nothing writes until the owner says go.
7. **Commit**:

   ```bash
   DATABASE_URL="$PROD" TMDB_API_KEY="…" node scripts/award-import.mjs apply <plan> --commit
   ```

8. **Draft the announcement** — one sentence, from the counts in the plan, e.g.
   *"One Battle After Another leads the DGA nominations with four."* Show it,
   get approval, then:

   ```bash
   DATABASE_URL="$PROD" node scripts/award-import.mjs finish DGA --message "…" --commit
   ```

   This is irreversible — the app has no notification deletion.

9. **Refresh**, last, after `finish`:

   ```bash
   DATABASE_URL="$PROD" REVALIDATE_SECRET="$(grep -m1 '^REVALIDATE_SECRET' .env.local | cut -d= -f2-)" \
     node scripts/award-import.mjs refresh DGA
   ```

   Titles are derived from what is in the database for that show and season —
   no need to pass `--titles` by hand; it is only an override.

   `refresh` runs after `finish`, not before: `finish` is what flips
   `nom_active`, which drives `needsNominations` on the show page, so running
   `refresh` earlier would clear the cache before that last change lands.
   `refresh` is not optional. It is the only thing that clears the cache the
   server actions clear, and it fails loudly if the nominees are not actually
   on the live page.

## The year

`context` gives the active season and that is what goes in `year`. Never take
it from the article's title: "Oscars 2026" means the **2025** season, and other
shows go the other way.

`apply` checks this empirically — it compares the release years of the films it
resolved against this season's draft picks and refuses if most fall outside.
**If it refuses, do not override it.** Go find a different listing, or ask the
owner for a link.

## Winners

Same as nominations with `"kind": "winners"`. The film must already be
nominated in that category or `apply` refuses — that refusal is load-bearing: a
win pays the category's points a second time, so a winner that was never
nominated holds points no page can explain.

**A winner in a person category must name the person** in `detailName`, the
same way its nomination did. The app records the winning *nomination*, not just
the film, so for a film nominated twice in the category the person decides who
is shown as the winner. `apply` finds the nomination by category, film, season
and person. It refuses if:

- the named person does not hold a nomination for that film in that category
  (the error lists the people who do), or
- no person is named and the film has more than one nomination in the
  category (the error lists the candidates). It never guesses.

A film with a single nomination in a category with no nominee names, such as
Best Picture, needs no `detailName`.

`finish` takes `--winners`, which clears `awards_active` instead of
`nom_active`.

## Live mode

No research. The owner says a winner; you write a one-category plan and run
`apply --commit` then `refresh` immediately, so the site is current within
seconds. Run `finish --winners --commit` once, at the end of the night, then
`refresh` once more — `finish` is the last write of the night and the cache
should reflect it too.

## Dates

The twelve shows announce next season's schedule one at a time across about
four months, so this is run every few weeks from autumn onward and only ever
looks at what is still outstanding. No notification is sent — a schedule is not
something to page every member about.

1. **Read what is already known.** This decides what to research:

   ```bash
   DATABASE_URL="$PROD" node scripts/award-import.mjs dates
   ```

   Every show is marked `skip` or `RESEARCH`, and each half says `current` or
   `not this season`. A show whose nominations date is current but whose
   ceremony is not gets researched for the ceremony only.

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

   - `year` is the active season `dates` printed, never the one in an
     article's headline.
   - `time` is `HH:MM` in the show's local zone, 24-hour. Omit it and the show's
     existing wall-clock time is reused, which is almost always right — these
     hold steady year over year. A show with no prior time falls back to 08:00
     for nominations and 20:00 for a ceremony, and the dry run says so.
   - `tz` defaults to `America/New_York`. Only set it if a show genuinely
     announces on another clock — BAFTA's London ceremony is stored in ET like
     the rest.
   - Name only the half that was announced. An entry without `awards` leaves
     the ceremony columns exactly as they are.
   - **A show that has not announced is left out of the plan entirely.** Never
     guess a date from last year's, and never write "mid-January".

4. **Dry run**, and show the owner the `current → proposed` table:

   ```bash
   DATABASE_URL="$PROD" node scripts/award-import.mjs set-dates .local/award-plans/dates-2026.json
   ```

   It refuses the whole plan — writing nothing — if `year` is not the active
   season, a show is unknown, no source is recorded, or any date falls outside
   the season (1 August of the prior year to 31 July). A refusal on the season
   window almost always means last year's announcement; go and find this
   year's.

5. **STOP. Wait for approval.**

6. **Commit:**

   ```bash
   DATABASE_URL="$PROD" REVALIDATE_SECRET="$(grep -m1 '^REVALIDATE_SECRET' .env.local | cut -d= -f2-)" \
     node scripts/award-import.mjs set-dates .local/award-plans/dates-2026.json --commit
   ```

   This revalidates each changed show itself, so the show page's schedule is
   current. Without the secret it refuses before writing anything and exits 1
   — set it and re-run. A dry run, without `--commit`, needs no secret.

### What to know about the shows

- **AFI has no ceremony.** It names ten films and declares no winners, so its
  `awards` half is permanently blank and `dates` will always list its ceremony
  as `not this season`. That is correct — never invent one, and do not report
  it as outstanding.
- **A date that moves.** If a show reschedules, its date is already "current"
  and will be skipped. Set `"recheck": true` on that show's entry to write it
  anyway.
- **Ceremonies are evening events**, so their stored time exceeds 24 hours —
  an 8pm ET show on the 11th is 01:00Z on the 12th but belongs on the 11th.
  The script handles this, daylight saving included; do not try to
  pre-compute it in the plan.

## Never

- Never create an `awards` row. Categories are set up once per show in the
  admin UI; report an unmatched heading instead.
- Never pass `--commit` before the owner has seen the dry run.
- Never skip `refresh` — a correct write nobody can see is not done.
- Never run any of this against `localhost:5433` expecting it to matter, or
  against `$PROD` expecting it not to.
- Never guess an unannounced date from last season's, and never null a date
  that is merely stale — leave it and report it.
- Never write durations. Nothing announces one and the existing values are right.
