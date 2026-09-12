---
name: award-entry
description: Use when entering an award show's nominations or winners — "DGA nominations", "Oscars winners", "run the SAG show live". Researches the listing, proposes every nomination for approval, writes to production, clears the cache, and broadcasts one notification.
---

# Entering an award show

Three modes, one procedure. Mode comes from the ask:

| Ask | Mode |
|---|---|
| "DGA nominations" | nominations — research a listing, enter every category |
| "Oscars winners" | winners — one listing, every category at once |
| "run the Oscars live" | live — one category at a time, as they are announced |

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
   `apply` refuses without it.
4. **Write the plan** to `.local/award-plans/<abbr>-<year>-nominations.json`
   (gitignored; it names films before the site does):

   ```json
   {
     "kind": "nominations",
     "eventAbbreviation": "DGA",
     "eventId": 7,
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
7. **Commit**, then refresh:

   ```bash
   DATABASE_URL="$PROD" TMDB_API_KEY="…" node scripts/award-import.mjs apply <plan> --commit
   DATABASE_URL="$PROD" REVALIDATE_SECRET="$(grep -m1 '^REVALIDATE_SECRET' .env.local | cut -d= -f2-)" \
     node scripts/award-import.mjs refresh DGA --titles "Sinners,One Battle After Another"
   ```

   `refresh` is not optional. It is the only thing that clears the cache the
   server actions clear, and it fails loudly if the new nominees are not
   actually on the live page.

8. **Draft the announcement** — one sentence, from the counts in the plan, e.g.
   *"One Battle After Another leads the DGA nominations with four."* Show it,
   get approval, then:

   ```bash
   DATABASE_URL="$PROD" node scripts/award-import.mjs finish DGA --message "…" --commit
   ```

   This is irreversible — the app has no notification deletion.

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

`finish` takes `--winners`, which clears `awards_active` instead of
`nom_active`.

## Live mode

No research. The owner says a winner; you write a one-category plan and run
`apply --commit` then `refresh` immediately, so the site is current within
seconds. Run `finish --winners --commit` once, at the end of the night.

## Never

- Never create an `awards` row. Categories are set up once per show in the
  admin UI; report an unmatched heading instead.
- Never pass `--commit` before the owner has seen the dry run.
- Never skip `refresh` — a correct write nobody can see is not done.
- Never run any of this against `localhost:5433` expecting it to matter, or
  against `$PROD` expecting it not to.
