# Parity matrix

**What the source app does, and whether the port does it.** Cutover is blocked
while any row is open.

| | |
|---|---|
| Audited | 2026-08-15 |
| Source | `cinemadraft` @ `caa1e7f` (2023-12-12), read-only |
| Port | `cinemadraft-nextjs` @ end of Phase 6 |
| Source surface | 19 route files · **71 endpoints** · 17 controller modules · **81 exported functions** · 24 client routes · 9 sub-views · 80 page files |
| Evidence | 32 captured API fixtures (`fixtures/*.path`); every row below cites a file read on both sides |

## Where it stands

| Verdict | Count |
|---|---|
| **ported** | 52 |
| **deficient** | 17 |
| **dropped** | 15 |
| **total capabilities** | 84 |

🔴 **Recompute these from the table; never increment them.** The counts drifted
by one during Phase 10 and went unnoticed for four batches, because each task
adjusted the header by its own delta rather than recounting.

_Audited at the end of Phase 6 (18 ported). Phase 8 closed seven rows: film
search and the whole award-show surface, including both admin writes the source
left unauthenticated. Phase 9 closed the per-award points breakdown. Phase 10
batch A added the navigation and the error boundaries; batch B closed the four
league-formation rows — until it landed, **no new league could be created at
all** — batch C closed the six for running a season, batch D closed the film
page, similar films, browse and the watched mark, and batch E closed the four
watchlist rows — the paged list and all three progress views — both review
rows, the first writes this app has made against a table with no production
data behind it, and the three profile rows: a member's page, and posting to and
deleting from your own feed._

🔴 **Read this the right way round.** The port has the harder half done — auth,
the data layer for every table, scoring, the draft — and the *broad* half
outstanding. The 43 open rows are not 43 phases of work: most already have
their repository and need only a page; the rest need a repository written
first, and those are almost all *writes*, which is where the time goes.
The split is in the **Data** column, and it is the honest measure of what is
left.

## How to read a row

- **ported** — a person can do this in the new app today, cited by file.
- **deficient** — they cannot, and they should be able to. Carries a `P10.Tn`.
- **dropped** — they cannot, and that is intended. Carries a reason.

🔴 **There is no "partial".** Something that half works is **deficient**, so
that a green row can be read as "yes, that works" without qualification.

The **unit is the capability, not the endpoint** (D53). D8 removed the HTTP
layer, so an endpoint-for-endpoint audit would mark the whole application
deficient while being true of nothing. Several endpoints plus a page often make
one row.

**Data** column: `✓` the repository method exists, `—` it does not and Phase 10
must write it. Almost every *read* is covered and almost every *write* is not,
which is why so many rows are cheap and a few are not.

---

## Auth and accounts

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| Register and sign in | **ported** | `src/pages/auth/Register.js`, `routes/auth.js:29` | `app/auth/sign-up`, `app/auth/sign-in` — Clerk replaces Auth0 (D6) | ✓ |
| An existing member keeps their history on first sign-in | **ported** | Auth0 `user_id` on `users` | `lib/services/clerk-identity.ts` — claim by verified email (§9) | ✓ |
| Sign out | **ported** | `src/pages/Logout.js` | Clerk `<UserButton>` | ✓ |
| Admin repairs a mis-linked account | **ported** | — (no source equivalent) | `actions/admin/relink.ts` — needs a UI, see admin below | ✓ |
| **Join a league from an invite link** | **ported** | `src/pages/join.js`, `POST /draft/uuid/:uuid` (`routes/draft.js:50`) | `app/(app)/join/[uuid]`, `actions/leagues/join-league.ts` — names the league before registering, and joining is an explicit act so a link unfurl cannot join for you | ✓ |
| Last-login timestamp | **dropped** | `routes/auth.js:28` → `User.updateLastLogin` | Auth0 bookkeeping; nothing renders it, and Clerk records last sign-in itself | |
| Change profile picture | **dropped** | `PUT /user/image` (`routes/user.js:8`) | Clerk owns the avatar now; a second store would disagree with it | |
| `GET /token/generate` | **dropped** | `routes/index.js:61` | Returns 64 random bytes to anyone who asks. No caller in the client. Not a capability | |

## Dashboard

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| Upcoming ceremony dates | **ported** | `GET /dashboard` (`routes/dashboard.js:62`) | `components/SeasonRail.tsx` | ✓ |
| See your roster and league standings at a glance | **ported** | — (source put this on the league page only) | `lib/services/dashboard.ts` — a betterment, not parity | ✓ |
| Signed-out visitors see the season | **ported** | Dashboard was public (`src/routes/index.js:66`) | `app/(app)/page.tsx`, `getDashboard(null)` (D44) | ✓ |
| Films in cinemas now | **deficient** | `NowShowing` carousel, `GET /movie/now-playing` | **P10.T2** — needs TMDB (Phase 8) | — |
| "Watch live" banner during a ceremony | **deficient** | `dashboard/components/LiveCTA.js:35-63` | **P10.T3** — the only route into the live page | ✓ |
| Season leaderboard by year | **deficient** | `MovieResultsByLeague`, `GET /points/year/:year` | **P10.T4** | ✓ |
| Welcome callout card | **dropped** | `HeadCallout` | MUI Minimal template chrome, not a feature (D3) | |

## Films

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| **A film's page** — synopsis, cast, crew, trailers, images, ratings, box office | **ported** | `src/pages/movie/index.jsx`, `GET /movie/:id`, `/details` | `app/(app)/films/[tmdbId]/page.tsx` + `lib/services/film.ts`. Keyed by **TMDB id**, so it resolves for films the app has never cached, and it **never writes** (D63). Ratings and box office come from OMDb and the panel is omitted when there is no key. 🔴 Trailers are a **facade**: the source mounted an `<iframe>` per video — 32 YouTube players for *La La Land* on a page nobody had asked to watch anything on — where this mounts one on demand, through `youtube-nocookie.com` so a logged-out reader picks up no advertising cookies | ✓ |
| A film's points by award show | **ported** | `GET /points/movie/:tmdbId` | `components/FilmPointsPanel.tsx`. `byEvent` is a regrouping of `ledgerForMovies`' lines, so the per-show rows always sum to the total (D41). Verified against `fixtures/points-by-movie.json`: 335 total, 170 Oscars, 65 GG, 55 BAFTA. `avgDraftPos` is **null, never 0**, when nobody drafted the film | ✓ |
| Browse upcoming and recent releases | **ported** | `src/pages/browse/index.js`, `GET /movie/discovery/...` | `app/(app)/browse/page.tsx` + `lib/services/browse.ts`. Grouped by release month with the green watched badge on each poster. 🔴 The past and future sides are **two different queries**, not one sort reversed — the past side keeps the source's `vote_average >= 4` / `vote_count >= 200` floors and the future side sends none, because an unreleased film has no votes and carrying them over returns an empty page | — |
| Browse state is linkable | **ported** | Held in `useState` with an intersection observer appending pages (`browse/index.js:29-70`) | `?when=&page=` (D65). The source could not link a film, lost the reader's place on Back, could not reach page 12 from a keyboard, and re-fired its sentinel on every re-render. "Show more" is a real link | — |
| Search for a film by title | **ported** | `GET /search` | `lib/services/search.ts` — local-first, three ranked contexts (§10). TMDB is an optional second source and is unconfigured; the 1,355 local films answer it completely | ✓ |
| Similar films | **ported** | movie page "Similar Movies" grid | On the film page, out of the same TMDB request. 🔴 Sourced from **`/recommendations`, not the source's `/similar`** — measured 2026-08-17, `/similar` answers *La La Land* with *The Tigger Movie*, *Mommie Dearest*, *Xanadu* and *A Goofy Movie*, because it matches shared keywords and genres and a musical drags in every animated film with a song in it. `/recommendations` answers *Pretty Woman*, *Burlesque*, *(500) Days of Summer*. `similar` is kept as a fallback for obscure titles, where `recommendations` is empty | — |

## Leagues

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| See a league's draft board | **ported** | `/leagues/:id/explore/:group` (`src/routes/index.js:106`) | `app/(app)/leagues/[id]/page.tsx` | ✓ |
| The board is public | **ported** | Public in source — 🔴 the sibling `/leagues` routes are guarded, this one is not | `proxy.ts` lists `/leagues/(.*)` (D44/D45) | ✓ |
| Switch season | **ported** | year `<Select>` on the league page | `app/(app)/leagues/[id]/page.tsx` | ✓ |
| Groups | **ported** | `:activeGroup` segment | Every group renders; no pagination needed | ✓ |
| **A league's standings, on the league page** | **deficient** | "League points" panel, `GET /points/league/...` | **P10.T10** — exists on the dashboard, but only for signed-in members, so a visitor on a shared link sees no scores | ✓ |
| **Create a league** | **ported** | `src/pages/league/create.js`, `POST /league/add` | `app/(app)/leagues/new`, `actions/leagues/create-league.ts` — seats the creator, writes a parseable owner column (D47), generates the invite uuid | ✓ |
| **Your leagues, and switching between them** | **ported** | `src/pages/league/redirect.js`, `GET /league/user` | `app/(app)/leagues/page.tsx` + `lib/services/my-leagues.ts`. 🔴 Shows a **list** rather than redirecting to the first league as the source did — that redirect meant no page ever answered "which leagues am I in" | ✓ |
| Copy the invite link | **ported** | `JoinLink` on create + league panel | `components/InviteLink.tsx`, on the league page, **owners only** — the uuid is the join credential | ✓ |
| **Set up groups before a draft** | **ported** | `league/orderAndGroups/`, `PUT /draft/:leagueId/:id` | `app/(app)/leagues/[id]/setup` + `lib/services/group-assignment.ts`. Assignment is a select per seat, not drag-only, so it works by keyboard; the randomiser deals round-robin, keeping groups balanced | ✓ |
| Add a seat, including a placeholder for someone with no account | **ported** | `POST /draft/add` (`routes/draft.js:51`) | `actions/leagues/manage-seats.ts` — owner-gated, closing source bug 4 | ✓ |
| Remove or rename a seat | **ported** | `DELETE /draft/:id`, `PUT /draft/:leagueId/:id` | `actions/leagues/manage-seats.ts` — owner-gated (closing source bug 5), and refuses a seat holding picks, which would orphan them | ✓ |
| Start the draft / mark it complete | **ported** | Start/Complete buttons, `PUT /league/:id`, `/status` | `actions/leagues/manage-league.ts` — status only, closing source bug 6. *Posting picks to each member's feed waits for the feed itself (T40–42)* | ✓ |
| Stage next season's draft | **ported** | "Stage next draft" adornment on the year select | `actions/leagues/manage-league.ts` — idempotent, carries placeholders forward | ✓ |
| League settings | **ported** | `PUT /league/:id` | `actions/leagues/manage-league.ts` — named fields through a Zod allowlist, so the source's take-the-league bug (6) is impossible | ✓ |

## The draft

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| The owner assigns a pick to a seat | **ported** | `POST /draftpicks/add`, drag panel | `actions/draft/add-pick.ts`, `components/DraftConsole.tsx` (D46) | ✓ |
| Remove a pick | **ported** | `DELETE /draftpicks/:id` | `actions/draft/remove-pick.ts` | ✓ |
| Reorder a seat's picks by dragging | **ported** | `POST /draftpicks/reorder` | `components/PickList.tsx` — keyboard too, which the source lacked | ✓ |
| Whose turn it is, advancing automatically | **ported** | "Auto-advance" checkbox, linear or snake | `lib/services/draft-order.ts` — snake confirmed against 309 of 310 live picks (D50) | ✓ |
| Posters on the board | **ported** | pick strips | `components/PickCell.tsx` + `lib/utils/poster.ts` | ✓ |
| Per-pick point totals on the board | **ported** | `POST /points/ids` | `lib/services/draft.ts` via `pointsForMovieIds` (D41) | ✓ |
| **A private ranked pre-draft list** — add films, drag to rank, mark taken or unavailable | **ported** | `/list`, `GET/POST /lists/:year`, `/order`, `/status`, `/delete` | `app/(app)/list/page.tsx` + `components/DraftListEditor.tsx` on the shared `components/ReorderableList.tsx`, `lib/services/draft-list.ts`, `actions/draft-list/*`, writes in `lib/repositories/lists.ts`. The year is validated against `available_years` (closing bug 10), and every write is scoped to the caller's own rows — the source's `/lists/delete/:id` had no owner clause at all | ✓ |
| Live board updates while the draft runs | **deficient** | polling | **P10.T21** — Phase 14 with the live page (D48) | ✓ |

## Award shows

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| Every award show | **ported** | `/award-shows`, `GET /events` | `app/(app)/award-shows/page.tsx` | ✓ |
| **One show: its categories, point values, nominees and winners** | **ported** | `/award-shows/:abbr`, `GET /events/:abbr[/:year]` | `app/(app)/award-shows/[abbr]/page.tsx` — point values resolved through `pointsId` (D41) | ✓ |
| Past seasons of a show | **ported** | year `<Select>` | Season nav on the show page | ✓ |
| Subscribe to ceremony dates as a calendar | **deficient** | `GET /events/calendar.ics` | **P10.T25** — one of the three `/api` routes D8 permits | ✓ |
| Admin: edit a show's dates and live flags | **deficient** | `PUT /events/:abbr` (`restrictToAdmin`) | **P10.T26** | — |
| Admin: add or delete a category | **deficient** | `POST/DELETE /awards` (`restrictToAdmin`) | **P10.T27** | — |
| Admin: enter nominations | **ported** | `nominations` sub-view, `POST /nominations` | `actions/awards/attach-nominee.ts` — 🔴 admin-gated, closing bug 1 | ✓ |
| Admin: pick winners during the ceremony | **ported** | `winner` sub-view, `POST /winners` | `actions/awards/set-winner.ts` — 🔴 admin-gated, closing bug 1. Correcting is the same action; live *broadcast* is phase 14 | ✓ |
| Admin: which shows still need entering | **ported** | "Events needing updates" card | `app/(app)/award-shows/page.tsx`, from the source's own `nom_active` / `awards_active` flags | ✓ |

## Live ceremony

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| **Watch results land in real time, with league standings beside them** | **deficient** | `/live/:abbr`, socket.io `subscribeToLiveEvent` | **P10.T31** — Phase 14 (D13/D23/D48) | ✓ |
| The admin's selection drives every watcher's screen | **deficient** | `sendSelectedAward` / `newWinner` | **P10.T32** | ✓ |

## Watchlist

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| **Your watched films, paged and sorted** | **ported** | `/watchlist`, `GET /watchlist/:page/:col/:dir` | `app/(app)/watchlist/page.tsx` (`?view=films`), `lib/services/watchlist.ts` → `loadWatchedFilms`, `components/Pagination.tsx`. Sorted across the whole list before paging — the source sorted only the 25 rows a page had already chosen | ✓ |
| Mark a film watched, or unmark it | **ported** | `POST /watchlist/item`, `DELETE /watchlist/item/:id` | `actions/watchlist/set-watched.ts` + `components/WatchedToggle.tsx`, on browse and the film page. 🔴 Keyed on **(userId, movieId)**, not the row id the source took off the URL — another person's row is not addressable at all. Takes the desired state rather than toggling, so a stale badge cannot send the wrong request | ✓ |
| Progress against this year's nominees, by show | **ported** | Awards tab, `GET /watchlist/awards/:year` | `?view=awards` → `loadShowProgress`, `watchlistRepository.findNomineeProgressByUser`. Both totals the source computed — nominations seen and films seen — in one query for the season | ✓ |
| Progress against the year's nominated films | **ported** | Nominations tab, `GET /watchlist/noms/:year` | `?view=nominations` → `loadNominatedProgress`, `watchlistRepository.findNominatedFilmProgressByUser`. Counted in Postgres rather than by reading every row of the year into JavaScript | ✓ |
| Which drafted films you have seen | **ported** | Draft tab, `GET /watchlist/drafts/:year` | `?view=drafted` → `loadDraftedProgress`, `watchlistRepository.findDraftedFilmProgressByUser`. 🔴 Scoped to the leagues the caller holds a seat in **and** to their own marks; the source's `Watchlist.getByAwards` filtered by neither | ✓ |
| Deep-link a watchlist tab | **dropped** | Tabs are component state (`watchlist/index.js:25-41`) | Impossible in the source. The port puts the tab in the URL — `/watchlist?view=awards`, with page and sort beside it — a betterment, not a parity row | |

## Reviews and profiles

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| Rate and review a film | **ported** | `/reviews/:tmdbId`, `POST /reviews/tmdbId/:tmdbId` | On the film page, not a page of its own: `app/(app)/films/[tmdbId]/page.tsx` → `components/ReviewForm.tsx` + `components/RatingInput.tsx`, `actions/reviews/save-review.ts` / `delete-review.ts`, `reviewRepository.saveForUserAndMovie`. 🔴 The 0–5 half-star scale is **validated**; the source's route stored whatever number arrived. *The source's "share on your profile" switch waits for the feed (T41)* | ✓ |
| Read your own review | **ported** | `GET /reviews/tmdbId/:tmdbId` | `loadMyReview` → `components/ReviewCard.tsx`. 🔴 Scoped to the caller; the source filtered on the film alone once a session existed, so it could load a stranger's review into your edit form | ✓ |
| **A member's profile and activity feed** | **ported** | `/user/profile/:uuid`, `GET /profile/feed/user/:uuid` | `app/(app)/members/[uuid]/page.tsx` → `lib/services/profile.ts`, `components/FeedPost.tsx`. 🔴 Route is `/members/[uuid]` (R16) and readable by any signed-in member, not public (R7). Reached from the league seat list, which links each held seat's name — the one inbound link (R23); a member's uuid is rendered nowhere else, so without it the page had no way in. Trap 6: 89 of the 125 restored rows spell `components` double-escaped, and the source's getter threw on null — `parseComponents` reads both spellings and returns nothing for null | ✓ |
| Post to your feed | **ported** | `POST /profile/feed` | `actions/profile/post-feed-item.ts` → `profileFeedRepository.create`, from `components/FeedComposer.tsx` on your own profile. 🔴 The target feed comes from the session, never from the request (R15) | ✓ |
| Delete a feed item | **ported** | `DELETE /profile/feed/:id` | `actions/profile/delete-feed-item.ts` → `profileFeedRepository.deleteByIdAndUserUuid`, which matches the id and the caller's uuid in one statement (R15) | ✓ |
| The profile tab strip | **dropped** | `users/UserProfile.js:109-117` | Every tab is commented out; it renders an empty strip. Reproducing a blank control is not parity | |

## Notifications

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| Your recent notifications | **deficient** | `GET /notifications` | **P10.T43** | ✓ |
| Mark as read | **deficient** | `PUT /notifications/read` | **P10.T44** | — |
| Admin: broadcast to everyone | **deficient** | `POST /notifications/type/:type` | **P10.T45** — the `:type` segment is ignored; it always sends to all | — |
| Dismiss one notification | **dropped** | `DELETE /notifications/:id` (`routes/notifications.js:30`) | 🔴 **Dead as written.** No auth middleware, so `req.user` is never set, and the controller's guard throws on every call. It has never once succeeded in production. Rebuild it in P10.T44 only if the owner wants it | |

## Reference and admin

| Capability | Verdict | Source | Port / task | Data |
|---|---|---|---|---|
| Rules and scoring explained | **deficient** | `/rules-and-scoring` — static copy | **P10.T46** — cheapest row here; it is two cards of prose | n/a |
| The scoring rulebook by tier | **deficient** | `GET /points` | **P10.T47** | ✓ |
| Admin: set the active season | **deficient** | — (source read an env var; changing seasons was a redeploy) | **P10.T48** — the action exists, the control does not (D22) | ✓ |
| Admin: relink an account | **deficient** | — | **P10.T49** — action exists, no page | ✓ |
| A 500 page | **ported** | `/500` | `app/error.tsx`, `app/(app)/error.tsx`, `app/global-error.tsx` + `components/ErrorPanel.tsx`. Four kinds, each with its own words and way out | n/a |
| A 404 page | **ported** | `/404` | `not-found` — Next's, styled by the app shell | n/a |
| Maintenance page | **dropped** | `/maintenance` | Unreachable in the source; nothing links to it | |
| `GET /health` | **dropped** | `routes/index.js:60` | Heroku dyno check. Vercel has its own | |
| 401 on any unknown GET | **dropped** | `routes/index.js:65` | The source answered 401 to unmatched GETs, which is wrong — the port 404s | |
| `/user` → `/dashboard/user/profile` | **dropped** | `src/routes/index.js:140` | The target does not exist in the route table; it lands on the catch-all and 404s. Dead as written | |
| Terms and conditions | **dropped** | `src/pages/termsAndConditions.js` | Not in the route table; unreachable | |
| `Watchlist.getByAwards` | **dropped** | `server/controllers/watchlist.js:69-87` | No route reaches it, and it filters only on `movieId != null` — porting it as written would return every user's rows | |
| Login as its own page | **dropped** | `PATH_AUTH.login` links to a route that was never registered | The link 404s in the source. Clerk's sign-in page is the port's answer | |
| 60 requests/minute/IP | **dropped** | `routes/index.js:30-36` | Express rate limiter. Vercel's platform limits replace it; revisit if abuse appears | |

---

## 🔴 Bugs found in the source, deliberately not ported

Recorded so that nobody "restores parity" by reintroducing one. Each was read
in the source and, where the data could settle it, measured.

| # | Bug | Evidence | Port |
|---|---|---|---|
| 1 | ✅ *Closed in the port by Phase 8 for nominations and winners.* **Six writes have no auth at all** — `POST/DELETE /nominations`, `POST/DELETE /winners`, `POST /movie`, `POST /years`. Nominations and winners are the scoring inputs, so anyone on the internet can change every league's standings | `routes/nominations.js:28-29`, `routes/winners.js:8-9`, `routes/movie/index.js:54`, `routes/index.js:59`. No global auth: `server/index.js:81` mounts the router with only a rate limiter, and `createResponse` (`controllers/index.js:18`) adds none. Sibling admin writes in `awards.js`/`events.js` *do* use `restrictToAdmin` | P10.T28/T29 ship these admin-gated. **Live on Heroku until cutover** — the owner has decided the source stays untouched |
| 2 | **`Winners.movie` joins on the wrong key.** `hasOne(Movies, { foreignKey: 'id' })` with no `sourceKey`, so it matches `Movies.id = Winners.id` instead of `Winners.movieId`. `Nominations` gets this right | `server/models/winners.js:11-14` vs `models/nominations.js:27-31`. **Measured: 733 of 734 winner rows resolve to the wrong film** — one is right by coincidence | `lib/repositories/winners.ts` selects `movieId` explicitly and declares no association |
| 3 | **League ownership is a substring match** — `league.owner.includes(user.id)` against TEXT `"[3]"`, admitting strangers and locking out real owners | `routes/league.js:16`, `routes/draftpicks.js` | Fixed: `lib/services/league-access.ts` (D47). **Measured: 29 (league, stranger) pairs across 11 of 13 leagues** |
| 4 | **`verifyLeagueOwner` is a no-op on `POST /draft/add`** — it guards on `req.params.leagueId`, and that route carries the id in the body, so any signed-in user can add a seat to any league | `routes/draft.js:9-23, 51` | P10.T15 goes through `canManageLeague` |
| 5 | **`DELETE /draft/:id` has authentication but no authorization** — any signed-in user can delete any seat in any league | `routes/draft.js:60` | P10.T16 goes through `canManageLeague` |
| 6 | **`PUT /league/:id/status` writes the whole body and inserts a duplicate seat for the caller on every call**, rather than calling `Leagues.updateStatus` | `routes/league.js:49-61, 99` | P10.T17 writes only the status |
| 7 | **Hardcoded `year: 2024`** when a league is marked complete, so feed announcements are built from the wrong season | `routes/league.js:68` | P10.T17 uses the active year (D22) |
| 8 | **Reorder writes are never awaited** — `req.body.forEach(async …)`, so the response returns before the writes land and a failure is silent | `routes/draftpicks.js:28` | Fixed: one transaction, `lib/repositories/draft-picks.ts` |
| 9 | **`:type` is ignored in two routes.** `/points/league/total/…` and `/points/league/event/…` return identical payloads; `POST /notifications/type/:type` always sends to everyone | `routes/points.js:195-198`, `routes/notifications.js:29` | P10.T10/T45 either honour the distinction or drop the segment |
| 10 | **`POST /lists/:year` accepts any single segment as a year** and then ignores it in favour of the body | `routes/lists.js:12-14, 43` | P10.T20 validates |
| 11 | 🔴 **An OMDb API key is hard-coded in committed source** — `apikey: 'e4d963ed'`, beside a sibling request that correctly reads `process.env.OMDB_KEY`. A secret in git history cannot be rotated by editing a file | `server/routes/movie/details.js:15` vs `routes/movie/movie.js:53` | Not ported: `omdbEnv` reads `OMDB_API_KEY` and returns null when unset. **The source is untouched** (D54) — the key is still live and should be rotated at cutover |
| 12 | **The film page prints the same runtime for every film.** `moment.duration(101, 'minutes')` is a literal; `movie.runtime` is fetched and never read, so every film claims 1 hour 41 minutes | `src/pages/movie/index.jsx:88`; `fixtures/movie-by-id.json` has `runtime: 129` for La La Land, rendered as 1h 41m | P10.T5 reads `runtime`, pinned against the fixture in `lib/external/tmdb-film.test.ts` |
| 13 | 🔴 **`DELETE`/`POST /lists/delete/:id` destroys by id with no `userId` clause**, while every sibling write in the same controller scopes to `req.user.id`. Any logged-in member can delete any other member's pre-draft list entry | `server/controllers/lists.js:38-43` (`Lists.destroy` where `{ id }` only) vs `update`/`updateStatus`/`getByYear` in the same file, which all include `userId`; route at `server/routes/lists.js` | P10.T20's `removeFilm` deletes on `(id, userId)`. **The source is untouched** (D54) — live until cutover |

## 🔴 Traps to carry into Phase 10

Shapes where the obvious port is the wrong one. The first cost real money once.

1. **`awards.points` is a foreign key into `points.id`, not a point value.** Summing it scores "Performance by an Ensemble" as 1 instead of 5. Already handled — the repository exposes it as `pointsId` (D41) — and `controllers/nominations.js:69` makes it worse by selecting the FK *without* `pointsData`.
2. **`award.pointsData` is an array in the events queries and an object in the nominations queries**, purely because of `raw + nest`. Normalising to one shape breaks one consumer. `controllers/events.js:15-19` vs `controllers/nominations.js:15-16`.
3. **`Movies.poster` and `backdrop` are getters** that prefix a CDN base at runtime, so the field is a relative path in the database and an absolute URL in the response — and reverts under `raw: true`. `lib/utils/poster.ts` does this explicitly.
4. **`User.displayName` is a VIRTUAL**, selected as an attribute in four places, one of them under `raw: true` where it never materialises. Derive it in code; never select it.
5. ~~**`Nominations.year` is TEXT while every other year column is INTEGER.**~~ ✅ **Fixed in the port** by `20260816120000_nominations_year_integer` (D60). It caused silent wrong answers three times during the port — a comparison that forgets to convert matches nothing, so a film scores zero and no page says why. The restored data was clean (4,559 rows, no nulls, no non-numeric values), so the cast was lossless. **The source app still has TEXT**; anything reading the Heroku database directly must still convert.
6. **`ProfileFeeds.components` is a JSON string** beside a `componentsArray` virtual that parses it — and the getter throws on null.
7. **`movie.watchlist` is not the movie's watchlist**, it is the caller's entry, ids only, used as a boolean.
8. **`Leagues.owner` is a JSON string** whose parsing getter is bypassed under `raw: true`.
9. 🔴 **Every remaining row is built on the Phase 3.5 design system, not on what the
   screenshots show.** `SectionHead`, `Panel`, `Shelf`, `Button`, `StatusChip`,
   `Eyebrow`, `CinemaFrame`, `PosterFrame` — each new surface uses them and carries a
   Storybook story. `LetterboxRule`, `font-display`, the Archivo `wdth` axis and the
   `/tokens` gallery page were all deleted; the gallery is `.storybook/Styleguide.mdx`.
   No hairline card border, no all-caps heading outside `Eyebrow`, no squared or pill
   button, no machine-formatted date. See D67–D77 and `docs/PLAN.md` → Phase 10 for the
   four surfaces still owed and the primitives each needs.

## What the audit did not cover

Stated so the gaps are known rather than assumed:

- **The websocket layer** (`server/websockets.js`) was read only where the live page touches it. Phase 14 owns it.
- **TMDB and OMDb request shapes** in `server/routes/movie/*` were enumerated but not compared field-by-field against what the movie page renders. Phase 8 must do that before P10.T5 closes.
- **39 of 71 endpoints have no captured fixture**, so their response shapes rest on reading the source rather than on a recorded contract. Where a Phase 10 task depends on a shape, capture the fixture from Heroku **before** porting it (§13) — the app is still running.
- **Email**, if any is sent outside Auth0, was not looked for.
