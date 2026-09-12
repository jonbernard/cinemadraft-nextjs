# Award entry pipeline — nominations, winners, and the notification

**Status:** design, approved 2026-09-12
**Problem:** entering a show's nominations is currently one-by-one through the
admin UI, from a web listing, twenty-four categories at a time, under time
pressure on announcement morning.

The deliverable is a **skill** the owner invokes by saying "DGA nominations",
and a **script** that skill drives. The skill does the research and the
judgement; the script holds every invariant and is the only thing that touches
production.

## What already exists

| Fact | Where | Why it matters here |
|---|---|---|
| Writes go through Clerk-gated server actions | `actions/awards/attach-nominee.ts`, `set-winner.ts`, `actions/notifications/broadcast.ts` | A script cannot call them. It re-implements their invariants instead. |
| `nominations` needs a local `movies.id` | `lib/services/film-ingest.ts` | A title from a web listing is not yet writable; it has to become a cached TMDB film first. |
| `awards.points` is a **foreign key** into `points.id` | D41, `lib/services/scoring.ts` | The script never reads or writes it as a number. |
| `events.nom_active = true` means **"needs nominations"** | `lib/services/award-show.ts` (`needsNominations`) | Finishing a show sets it to `false`. The name reads backwards. |
| Some categories nominate a person | `awards.requires_nominee_name` | Those need `detail_name`, else the category renders a blank slot. |
| **Scoring is computed on read. There is no recompute.** | D59, `docs/PLAN.md:254` | Writing the rows *is* the regeneration — but the render still has to be invalidated. See "Scores" below. |
| Every award write ends in `revalidatePath(…)` | `attach-nominee.ts:83`, `set-winner.ts:60` | A script makes none of those calls, and `revalidatePath` cannot be called from outside the app. |
| Neon is reached only by passing `DATABASE_URL` explicitly | `.env` header comment, `scripts/upload-award-logos.mjs` | The script refuses to load any `.env` file. |

## Decision: how the pipeline talks to production

**Plain `node scripts/award-import.mjs` using `pg`, with `DATABASE_URL` given
on the command line.** Not an MCP server, and not an API route for the writes —
though one small route is unavoidable for the cache clear, see §1b.

- An MCP Postgres server would hand the model raw SQL against production with
  none of the invariants above — in particular the `awards.points` foreign-key
  trap, which silently corrupts every total in the app and looks fine on the
  page.
- A token-authed `/api/admin/import` route is a permanent new production
  surface, protected forever, for a job that runs about twelve times a year.
  `/api/revalidate` is the deliberate exception: it is the only operation with
  no out-of-process equivalent, it takes no data, and it changes nothing.
- A script is the established pattern in this repo, it dry-runs, it is
  reviewable before it writes, and its invariants are unit-testable.

**The cost, stated plainly:** the script re-implements the TMDB fetch and the
movie insert, because `lib/` is TypeScript behind `@/` path aliases that a
plain `.mjs` file cannot import. It can drift from
`movieRepository.upsertByTmdbId`. Mitigation: the insert writes exactly the
columns that function writes, a comment in both files names the other, and the
script's test pins the column list.

## Components

### 1. `scripts/award-import.mjs`

Four subcommands. Every one of them is read-only unless `--commit` is passed.

#### `context <ABBR>`

Dumps, as JSON:

- the `events` row (id, name, abbreviation, `nom_active`, `awards_active`)
- every `awards` row for it: `id`, `name`, `requires_nominee_name`, and the
  **resolved** point value joined through `points`
- the active season from `available_years`
- nominations already recorded for that event and season
- the release years of the films drafted in that season, for the year check

This runs **before** any web research. The skill matches the listing's category
headings against real `awards.name` values; it never invents a category.

#### `apply <plan.json> [--commit]`

Reads a plan file (schema below), and for each nominee:

1. Resolves the film — local `movies` row by `tmdb_id`, else fetch from TMDB
   and insert. `TMDB_API_KEY` comes from the environment.
2. Refuses the whole run if any category with `requires_nominee_name` has a
   nominee without `detailName`.
3. Refuses the whole run if the year check fails (below).
4. Skips any `(award_id, movie_id, year)` that already exists — so a run
   interrupted halfway resumes, and a double-run cannot double a film's points.
5. Inserts in one transaction.

Winners mode (`"kind": "winners"` in the plan) additionally refuses a winner
that is not already nominated in that category, and replaces rather than
inserts — one category, one winner — matching `winnerRepository.setForAward`.

Dry run prints the full resolution table: category → award id, title → tmdb id
+ release year, person name, and a separate **Unresolved** block at the top for
anything ambiguous or unmatched.

#### `finish <ABBR> --message "…" [--commit]`

1. Sets `events.nom_active = false` (or `awards_active = false` for winners).
2. Inserts one `notifications` row per user — message, `link`
   `/award-shows/<abbr>`, icon null — in one statement, matching
   `notificationRepository.broadcast`.

This is irreversible: the app has no notification deletion (R8). `--commit`
prints the recipient count and requires the message to be non-empty.

#### `refresh <ABBR> [--year N]`

Two steps, always run together, always run after a committed `apply`:

1. `POST /api/revalidate` with the shared secret and the abbreviation — the app
   then calls the same `revalidatePath` invocations the server actions make.
2. `GET https://cinemadraft.com/award-shows/<abbr>?year=<N>` and assert every
   title just written appears in the response. The page is public (D44), so no
   session is needed.

Step 2 is what makes step 1 honest: a revalidation that silently did nothing
fails here rather than at the ceremony. This is the "regeneration" step — see
**Scores** below for why it is a cache clear and not a recompute.

### 1b. `app/api/revalidate/route.ts`

About twenty lines. `POST` only, body `{ secret, abbreviation, year }`.

- Compares `secret` against `REVALIDATE_SECRET` with
  `crypto.timingSafeEqual`, and returns 404 — not 401 — on a mismatch, so the
  route does not advertise itself.
- Revalidates a **fixed allowlist** of paths derived from the abbreviation:
  `/award-shows/<abbr>` (layout), `/award-shows`, `/leaderboard`, `/`. The
  caller cannot name an arbitrary path.
- Added to the public matcher in `proxy.ts` alongside `/api/webhooks/(.*)`,
  because it authenticates by secret rather than by session — the same shape as
  the Clerk webhook.

🔴 This is the one piece of new production surface this design adds, and it is
added only because `revalidatePath` has no out-of-process equivalent. It writes
nothing and reads nothing; the worst an attacker with the secret can do is make
four pages re-render.

### 2. `.claude/skills/award-entry/SKILL.md`

One skill, not two. Mode is inferred from the invocation — "DGA nominations",
"DGA winners", "Oscars live" — because event resolution, year resolution, film
matching, the plan file and the approval gate are identical for all three, and
two skills would duplicate them.

The procedure it encodes:

1. Run `context <ABBR>`. Stop and ask if the abbreviation is unknown.
2. Search the web for the listing. Prefer a source that lists every category on
   one page. Record every URL used in the plan file.
3. Build the plan: map each listing heading to an `awards.id` from step 1.
   Anything unmatched goes in the plan's `unmatched` array — never dropped
   silently, never guessed into a near-miss category.
4. Run `apply --dry-run`. Show the owner the resolution table and the
   unresolved block.
5. **Stop for approval.** Nothing writes until the owner says go.
6. `apply --commit`, then `refresh` — which clears the cache and proves the
   new nominees actually render on the live page.
7. Draft a one-sentence highlight from the counts in the plan — e.g. *"One
   Battle After Another leads DGA nominations with four."* Show it, get
   approval, then `finish --commit`.

Live-winners mode skips the research: the owner says a winner, the skill runs a
single-nominee `apply --commit` for that category, and `finish` runs once at the
end of the night.

### 3. Plan file

Written to `.local/award-plans/<abbr>-<year>-<nominations|winners>.json`
(`.local/` is already gitignored, and this file names films before they are
public on the site).

```jsonc
{
  "kind": "nominations",        // or "winners"
  "eventAbbreviation": "DGA",
  "eventId": 7,
  "year": 2025,                  // what goes in nominations.year
  "sources": ["https://…"],
  "unmatched": ["Best Documentary — no such category for this event"],
  "categories": [
    {
      "awardId": 42,
      "awardName": "Outstanding Directorial Achievement in Theatrical Feature Film",
      "requiresNomineeName": true,
      "nominees": [
        {
          "title": "One Battle After Another",
          "tmdbId": "1234567",
          "detailName": "Paul Thomas Anderson",
          "detailCharacter": null
        }
      ]
    }
  ]
}
```

`tmdbId` may be omitted; `apply` resolves it by title and reports every
ambiguous match instead of picking one. The skill then pins the id and re-runs.

## The year

`nominations.year` is the **season**, and the season is whatever
`available_years` says is active — the same number `getActiveYear()` returns.
The skill never derives it from the listing's own title, because "Oscars 2026"
means the 2025 season and "DGA 2026" may not.

**The check that catches a wrong listing.** `apply` compares the release years
of the films it just resolved against the release years of the films drafted in
the active season. If more than half the nominated films fall outside the
season's draft-pick range, `apply` refuses — with both distributions printed —
and the skill goes back for a different listing or asks the owner for a link.

This is enforced in the script, not left to the model's judgement, because it
is the one failure mode that produces a full, plausible, entirely wrong season
of data.

## Scores

**Scores are cleared, not recomputed — and the script cannot clear them
without help. That is why `/api/revalidate` exists.**

There is no recompute to call. `docs/PLAN.md:254` records D59: the materialized
totals, the recompute trigger, the reconciliation job and the nightly cron were
all cancelled after measurement — a full 16-seat league board costs 8 ms
*including* scoring. `lib/services/scoring.ts` is a pure function applied on
read, so a nomination row is live the instant it commits and a correction is
consistent by construction. Nothing in `.mjs` should re-implement `scoreMovies`;
`docs/PROGRESS.md:276` forbids a second copy of the rule.

What *does* go stale is the render. Every award write through the app ends in
`revalidatePath('/award-shows/<abbr>', 'layout')` — see `attach-nominee.ts` and
`set-winner.ts` — and a script writing straight to Neon makes none of those
calls. `revalidatePath` has no out-of-process equivalent, so the only way for
this pipeline to do what the admin UI does is to ask the running app to do it.
Hence the endpoint, and hence `refresh` being mandatory rather than optional
after a committed `apply`.

Scope of the staleness today is narrow — no `use cache`, no
`generateStaticParams`, no `revalidate` export anywhere in `app/`, and
`/award-shows/[abbr]` calls `getCurrentUser()`, which makes it dynamic — but
"narrow today" is not a property to build a seasonal process on, and the fetch
in step 2 is what proves it either way.

Note for completeness: `lib/external/cache.ts` (Vercel Runtime Cache) holds
**third-party TMDB and OMDB responses only**. It never holds a score, a
nomination or a total, and nothing in this pipeline touches it.

`refresh` is the **named seam**. If materialized totals ever return, or
`cacheComponents` is adopted (see the note in `lib/services/season.ts`), the
recompute or purge call goes in that function and the route it posts to — and
nowhere else. Every command in this pipeline already routes through it.

## Safety rails

1. The script exits if `DATABASE_URL` is absent. It never reads `.env`,
   `.env.local` or `.env.neon` — reaching production stays a conscious act.
2. Dry run is the default for every subcommand. `--commit` is required to write.
3. `apply` prints row counts for `nominations`, `winners` and `movies` before
   and after.
4. Idempotent on `(award_id, movie_id, year)`; a re-run is a no-op.
5. `finish` refuses an empty message and prints the recipient count first.
6. A `--database-url` that does not match `/\.neon\.tech/` prints a one-line
   warning naming the host, so a local run is obvious rather than silent.
7. `REVALIDATE_SECRET` lives in Vercel env and `.env.local`, never in the repo.
   `refresh` exits with a clear message if it is unset rather than skipping the
   cache clear quietly.

## Testing

`scripts/award-import.test.mjs`, in the style of
`scripts/upload-award-logos.test.mjs` — the pure functions, exported for it:

- plan validation: a person-category nominee missing `detailName` is rejected;
  an unknown `awardId` is rejected
- category matching: exact and near-miss heading → award name
- the year heuristic: a listing a season off is refused, one in season passes,
  and the boundary case of a season with no draft picks yet does **not** refuse
- the movie-insert column list, pinned against `movieRepository.upsertByTmdbId`
- winners: a winner that is not a nominee is rejected

`app/api/revalidate/route.test.ts` — a wrong secret answers 404, a missing
secret answers 404, a correct one revalidates exactly the allowlisted paths and
nothing the caller named.

No test writes to any database; the DB layer is passed in.

## Out of scope

- Creating categories. `awards` rows are set up once per show through the
  existing admin UI; a listing heading with no matching row is reported, not
  created.
- Deleting or correcting nominations. `remove-nominee.ts` and the admin UI
  already do this, and a bulk delete path is a strictly worse thing to have
  lying around than a manual one.
- Scheduling. The owner invokes this; nothing runs on a cron.
