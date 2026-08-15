# Phase 8 — Award Shows + Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the award show surface — where nominations and winners are entered — and the search that feeds it, three contexts deep.

**Architecture:** One `lib/services/search.ts` that queries the local `Movie` table first and ranks by context, with TMDB as an optional second source behind an interface. One `lib/services/award-show.ts` that assembles an event's categories, nominees and winners from repositories that already exist. Admin writes go through Server Actions gated on `requireAdmin`.

**Tech Stack:** No new dependencies. A Prisma migration adds a trigram index. TMDB is reached with `fetch`.

---

## 🔴 Why this phase is the dangerous one

Every other phase renders data. **This one creates it.** Nominations and
winners are the *inputs* to scoring — a wrong nomination changes what every
league in the app is playing for, and a wrong winner changes every standing on
the site. Spec §12 says it plainly: errors here propagate to every league.

Two consequences run through the plan:

1. **Admin-gated, and tested as such.** The source app left `POST`/`DELETE` on
   both nominations and winners **completely unauthenticated** (`PARITY.md`
   bug 1) — anyone on the internet could rewrite the scoring inputs. The port
   closes that, and the refusals are tested before the successes, the way the
   draft actions were.
2. **A correction is a normal event, not an exception.** Winners are announced
   live and get mis-entered; §12 says the design must treat correcting one as
   ordinary. So the correction path is built and tested in the same task as the
   marking path, never as a follow-up.

## 🔴 There is no recompute to trigger, and that is the finding

`PLAN.md` says marking a winner "triggers the phase 9 recompute" and that a
correction must "fully reverse the prior recompute". **Neither exists yet.**
Scoring is a pure function computed on read (`lib/services/scoring.ts`, D41);
there is no materialized points table, and `points` in the database is the
*rulebook*, not anyone's total.

So today a winner correction is consistent **by construction** — delete the
winner row and every total that reads it changes on the next render. There is
nothing to reverse because nothing was cached.

**That is worth writing down rather than skipping**, because it inverts the
work: the gate "a winner correction leaves no stale points" is trivially true
now and becomes hard the moment phase 9 materializes. So this phase writes the
test that proves points move when a winner changes, and **phase 9 inherits it
as a constraint it must not break**. A test that is easy to pass today is
exactly the test you want in place before you make it hard.

## 🔴 TMDB has no key in this repo, and the app must not need one

`server/routes/search.js` and five other source files read `TMDB_API_KEY`;
`.env.local` here has no such variable, and the owner has asked that secrets
not go into GitHub. The local `Movie` table holds **1,355 films, every one with
a `tmdbId`** — which is the entire drafting and nominating history of the
league.

So TMDB is an **optional second source behind an interface**, and the whole
phase is built and tested without it:

- Local search is complete on its own and is what the tests exercise.
- The TMDB fill is a module with a fake in tests; absent a key it is not called
  at all and search returns local results, which is a correct answer rather
  than a degraded one.
- Ranking, dedupe and the cache are tested against the fake, so they are real
  code with real coverage before a key exists.

What the owner loses until a key is supplied is narrow and gets stated at the
end of the phase: attaching a film **nobody has ever drafted or nominated**.

## Global Constraints

- **D8** — Server Components and Server Actions. No `/api` for any of this.
- **D33/D37** — `app/`, `actions/`, `components/` import no Prisma and no db client, and carry no hex literals. Five CI checks enforce it.
- **D44/D45** — award show pages are **public** (they were public in the source, including the admin sub-views, which were gated only inside the components). The proxy gets `/award-shows/(.*)` deliberately; the *controls* are gated, not the page.
- **D41** — scoring goes through `lib/services/scoring.ts`. No second implementation, and `awards.points` is a foreign key (`pointsId`), never a value.
- **D49** — mobile-friendly by default. The award show page is read by members on phones during a ceremony; the admin console is the desktop-first exception.
- **D22** — the season comes from `getActiveYear`, never an env var. 🔴 `NEXT_PUBLIC_ACTIVE_YEAR` still sits in `.env.local` and must not be read by anything built here.
- **D28** — latest stable for anything new.
- Every data-backed suite is added to `vitest.ci.config.mts` **before pushing**.

## File structure

| File | Responsibility |
|---|---|
| `lib/services/search-ranking.ts` | The pure ranking rule: score a candidate against a query and a context. Testable with no database. |
| `lib/services/search.ts` | Local-first search: query, merge the optional TMDB source, dedupe on `tmdbId`, rank, return. |
| `lib/external/tmdb.ts` | The only place that knows TMDB exists. Returns `[]` when no key is configured. |
| `lib/external/cache.ts` | Cache wrapper — Vercel Runtime Cache in production, an in-process map locally and in tests. |
| `lib/services/award-show.ts` | An event-year: categories, their point values, nominees, winners. |
| `actions/search/find-films.ts` | The typeahead's Server Action. Replaces `actions/draft/search-films.ts`. |
| `actions/awards/attach-nominee.ts` | 🔴 Admin-gated. Adds a nominee to a category. |
| `actions/awards/remove-nominee.ts` | 🔴 Admin-gated. |
| `actions/awards/set-winner.ts` | 🔴 Admin-gated. Marks or **corrects** a winner. |
| `components/FilmSearch.tsx` | The typeahead: debounced, cancelling, poster-first. |
| `components/NomineeGrid.tsx` | One category's nominees, winner sealed. |
| `app/(app)/award-shows/page.tsx` | Every show. Public. |
| `app/(app)/award-shows/[abbr]/page.tsx` | One show and its categories. Public; admin controls conditional. |
| `e2e/award-shows.spec.ts` | Attach a nominee, mark a winner, correct it, and watch a total move. |

---

## Task 1: The ranking rule, alone

**Files:** `lib/services/search-ranking.ts`, `lib/services/search-ranking.test.ts`

Ranking is where search is right or wrong, and it needs no database to test.
Doing it first means the interesting logic is covered before anything touches
Postgres or the network.

**Produces:**

```ts
export type SearchContext =
  | { kind: 'draft'; year: number; takenMovieIds: readonly number[] }
  | { kind: 'browse' }
  | { kind: 'award-admin'; year: number };

export type Candidate = {
  id: number | null;        // null for a TMDB-only result
  tmdbId: string | null;
  title: string;
  releaseYear: number | null;
  isLocal: boolean;
  nominatedYears: readonly number[];
};

export function rankCandidates(
  query: string,
  candidates: readonly Candidate[],
  context: SearchContext,
): Candidate[];
```

- [ ] **Step 1: Write the failing tests.** §10's table is the specification, so each row of it becomes a test:

```ts
it('🔴 ranks an exact title match above a prefix match', () => {
  const ranked = rankCandidates('dune', [prefix('Dune: Part Two'), exact('Dune')], browse);
  expect(ranked[0]?.title).toBe('Dune');
});

it('🔴 ranks a film already in the database above a TMDB-only result', () => {
  // Local rows are the valuable ones — already ingested, already scoreable,
  // already carrying an accent. A TMDB duplicate outranking one would offer
  // the owner the copy that cannot be drafted.
  const ranked = rankCandidates('dune', [tmdbOnly('Dune'), local('Dune')], browse);
  expect(ranked[0]?.isLocal).toBe(true);
});

it('🔴 in a draft, sinks a film already taken in the league', () => {
  // The console marks these as taken; ranking should not put one first.
  const ranked = rankCandidates('dune', [local('Dune', { id: 7 }), local('Dune 2')], {
    kind: 'draft', year: 2026, takenMovieIds: [7],
  });
  expect(ranked[0]?.title).toBe('Dune 2');
});

it('boosts a film nominated in the context year', () => {
  const ranked = rankCandidates('the', [local('The Other', {}), local('The One', { nominatedYears: [2026] })], {
    kind: 'award-admin', year: 2026,
  });
  expect(ranked[0]?.title).toBe('The One');
});

it('is stable for equal scores', () => {
  // Two identically-scored films must not swap places between keystrokes —
  // the owner is aiming at a row that would move under them.
  const twice = () => rankCandidates('a', [local('A One'), local('A Two')], browse).map((c) => c.title);
  expect(twice()).toEqual(twice());
});
```

- [ ] **Step 2: Run them and watch them fail.** `npx vitest run lib/services/search-ranking`

- [ ] **Step 3: Implement.** Score additively, sort descending, break ties by title so the order is total and therefore stable.

- [ ] **Step 4: 🔴 Never drop a candidate.** Ranking orders; it does not filter. A taken film sinks but still appears, because the console has to *show* that it is taken — a film that vanishes reads as "not in the system" and sends the owner hunting for it mid-call.

- [ ] **Step 5: Commit.**

---

## Task 2: Local search, with an index that suits it

**Files:** `prisma/migrations/<ts>_movie_title_search/migration.sql`, `lib/repositories/movies.ts`, `lib/services/search.ts`, tests

- [ ] **Step 1: Add the trigram index.** §10 asks for trigram or prefix. `pg_trgm` is available on Neon and the table is 1,355 rows — small enough that the index is about *behaviour*, not speed: trigram similarity is what makes a mistyped title findable, and the owner is typing what someone said aloud.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS movies_title_trgm ON movies USING gin (title gin_trgm_ops);
```

- [ ] **Step 2: Verify the extension actually installed** rather than assuming — `SELECT * FROM pg_extension WHERE extname = 'pg_trgm'`. If Neon's free tier refuses it, fall back to the `ILIKE` prefix index §10 offers as the alternative and record why in the plan's notes.

- [ ] **Step 3: Widen `movieRepository.search`** to return what ranking needs: the film, plus the years it was nominated in. One query, not one per film.

- [ ] **Step 4: Write `lib/services/search.ts`** — call the repository, build `Candidate`s, hand them to `rankCandidates`. With no TMDB source configured this is the whole function.

- [ ] **Step 5: Test against the real 1,355 rows.** A partial title finds the film; a mistyped one still does; a film taken in the league is ranked last but present.

- [ ] **Step 6: Add the suite to `vitest.ci.config.mts`.** It reads restored data.

- [ ] **Step 7: Commit.**

---

## Task 3: TMDB as an optional source

**Files:** `lib/external/tmdb.ts`, `lib/external/cache.ts`, tests

- [ ] **Step 1: 🔴 No key means no call and no error.** `searchTmdb` returns `[]` when `TMDB_API_KEY` is absent. Not a throw, not a warning on every keystroke — the app has 1,355 local films and local-only is a correct answer. Test this case first, because it is the one that runs today.

- [ ] **Step 2: Only call TMDB when local results are thin** (§10: "call TMDB only when local results are thin"). Fewer than 5 local hits is the trigger. Test that a query with plenty of local matches makes **no** network call — that assertion is what keeps the rate limit unspent during a live draft.

- [ ] **Step 3: Dedupe on `tmdbId`, local row winning.** A film must never appear twice, and the local copy is the one that can be drafted.

- [ ] **Step 4: Cache TMDB responses** keyed on query + year. `lib/external/cache.ts` wraps the Vercel Runtime Cache in production and an in-process `Map` locally, so tests and `next dev` need no Vercel runtime. **Load the `vercel:runtime-cache` skill before writing this** — it is the authority on the API and on which invalidation function touches which layer.

- [ ] **Step 5: Never let TMDB failure fail the search.** A timeout or a 429 returns local results. The owner is mid-draft; an error banner instead of the film they can see in the list is the worse outcome.

- [ ] **Step 6: Commit.**

---

## Task 4: The typeahead

**Files:** `components/FilmSearch.tsx`, `actions/search/find-films.ts`, tests

- [ ] **Step 1: Extract what the draft console already does.** `DraftConsole` has a working debounced search with keyboard selection; this task lifts it into a component both it and the award admin use, rather than writing a second one. §10 asks for 250 ms; the console uses 180 ms and that was chosen for a live call — keep the shorter one and make it a prop.

- [ ] **Step 2: 🔴 Cancel superseded requests.** The console guards with a `live` flag; a real cancellation via `AbortController` is better and §10 asks for it. Test: a slow first response that arrives after a fast second must not overwrite it.

- [ ] **Step 3: Poster-first results.** "This audience recognizes films by artwork faster than by title" (§10).

- [ ] **Step 4: Repoint `DraftConsole` at it** and delete `actions/draft/search-films.ts`. The console's tests must still pass untouched — that is the proof the extraction changed nothing.

- [ ] **Step 5: Commit.**

---

## Task 5: The award show pages

**Files:** `lib/services/award-show.ts`, `components/NomineeGrid.tsx`, `app/(app)/award-shows/page.tsx`, `app/(app)/award-shows/[abbr]/page.tsx`, `proxy.ts`, tests

**Produces:** `getAwardShow(abbr, year)` → the event, its categories in name order, each with its point value resolved through `pointsId` (D41), its nominees, and its winner.

- [ ] **Step 1: Public (D44).** Both pages render signed out. Add `/award-shows/(.*)` to the proxy's public list deliberately.

- [ ] **Step 2: 🔴 Resolve the point value through `pointsId`.** `awards.points` is a foreign key into `points.id`. "Performance by an Ensemble" stores `1`, which is the tier worth **5**. A page that prints `award.points` prints a lie, and it is the same trap that would have corrupted scoring (D41).

- [ ] **Step 3: One signal per fact.** Winner is the carmine corner seal; a live nomination is the top hairline. `PosterFrame` already implements both (`status: 'won' | 'nominated'`) — use it rather than adding a second treatment. The source used a size change *and* a green check for the same fact, and green wrongly reads as validation.

- [ ] **Step 4: Year switching**, from `availableYearRepository`, defaulting to `getActiveYear()`.

- [ ] **Step 5: The index page** lists all 12 shows. Admins additionally see which still need nominations or winners entered — `nomActive` / `awardsActive` are the source's flags for exactly that.

- [ ] **Step 6: Test the service against the real data** — the Oscars have categories, categories have nominees, and one nominee per category-year is a winner. Add the suite to `vitest.ci.config.mts`.

- [ ] **Step 7: Commit.**

---

## Task 6: Admin — attach and remove a nominee

**Files:** `actions/awards/attach-nominee.ts`, `actions/awards/remove-nominee.ts`, `lib/repositories/nominations.ts`, tests

- [ ] **Step 1: 🔴 Write the refusal tests first.** Signed out, signed in as a member, and signed in as a member of the league that owns nothing — none may attach or remove. **Assert the nomination table is unchanged**, not merely that the call failed. This is the endpoint the source app left open to the entire internet; the test is the thing that keeps it closed.

- [ ] **Step 2: `requireAdmin`**, the same gate `relinkUser` uses.

- [ ] **Step 3: Some categories need a nominee name.** `awards.requires_nominee_name` is set for acting and craft categories — a nomination there is a *person*, and `detailName` / `detailCharacter` / `detailId` carry them. Refuse an attach that omits a name when the category requires one, and test it: silently storing a null is how a category ends up listing four films and a blank.

- [ ] **Step 4: 🔴 `nominations.year` is TEXT** while every other year column is an integer (`PARITY.md` trap 5). Write the string; do not let a number through and rely on Postgres to cast it.

- [ ] **Step 5: Refuse a duplicate** — the same film, in the same category, in the same year. It is a double-click during a live announcement, and it would double that film's points.

- [ ] **Step 6: `revalidatePath('/award-shows/<abbr>', 'layout')`.**

- [ ] **Step 7: Commit.**

---

## Task 7: Admin — mark and correct a winner 🔴 the phase gate

**Files:** `actions/awards/set-winner.ts`, `lib/repositories/winners.ts`, tests

- [ ] **Step 1: Refusals first**, exactly as Task 6. The source left this open too.

- [ ] **Step 2: One winner per category-year.** Setting a winner where one exists **replaces** it — that is the correction path, and it is the ordinary case (§12), so it is the same action rather than a separate "correct" one. A second row would make two films winners of one category and double-count the win.

- [ ] **Step 3: The winner must be one of that category's nominees.** A win is worth a second helping of the award's points (D41's confirmed rule), so a winner that is not nominated scores points for a film with no nomination to earn them.

- [ ] **Step 4: Clearing a winner is supported** — the announcement was misheard and there is now no winner recorded. `DELETE` in the source; a `null` movie here.

- [ ] **Step 5: 🔴 The gate. Prove the points move.**

```ts
it('🔴 a corrected winner leaves no stale points', async () => {
  // Scoring is computed on read today (D41), so this passes by construction —
  // and that is exactly why it is written now. Phase 9 materializes totals,
  // and this test is the constraint it must not break. A test that is easy to
  // pass today is the one you want in place before you make it hard.
  const before = await pointsForMovieIds([filmA, filmB], year);
  await setWinner({ awardId, year, movieId: filmB });
  const after = await pointsForMovieIds([filmA, filmB], year);

  expect(after.get(filmA)).toBe(before.get(filmA)! - awardValue);
  expect(after.get(filmB)).toBe(before.get(filmB)! + awardValue);
});
```

- [ ] **Step 6: Add the suites to `vitest.ci.config.mts`** if they need restored data; seed instead where you can, so the security tests run on every push.

- [ ] **Step 7: Commit.**

---

## Task 8: E2E and close-out

- [ ] **Step 1: E2E** — as an admin, attach a nominee and see it in the grid; mark a winner and see the seal; correct it and see the seal move. As a signed-out visitor, see the page and none of the controls. Build a scratch event and category rather than writing into the real 12 shows, the way `e2e/draft.spec.ts` builds a scratch league — this suite *creates scoring data*, and league 1's history is real.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm run test && npm run test:ci && npm run build`, the five layering checks, and the CI excludes updated **before** pushing.
- [ ] **Step 3:** Tick P8.T1–T8; close `PARITY.md` rows **P10.T8, T22, T23, T24, T28, T29** and note that T26, T27 and T30 (editing a show, category CRUD, the needs-updating list) remain phase 10.
- [ ] **Step 4:** Record the decisions — the missing recompute, TMDB as optional, and the trigram outcome.
- [ ] **Step 5:** Commit, confirm CI green, and **tell the owner what a TMDB key would unlock** and what it costs to add.

---

## Notes for the executor

- **Search ranking is the only interesting logic here** and it needs no database. If a task is running long, that is the one that must still be right.
- **Do not read `NEXT_PUBLIC_ACTIVE_YEAR`.** It is still in `.env.local` and it is superseded (D22).
- **`awards.points` is a foreign key.** If you find yourself printing it, stop.
- **The admin refusal tests are the point of tasks 6 and 7**, not their overhead. The source shipped these endpoints open for years.
- **Do not build the live ceremony page** — that is phase 14, and it shares a transport with the realtime board (D48).
