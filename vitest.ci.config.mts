import { config, EXCLUDE } from './vitest.config.mts';

/**
 * The subset of the suite that can honestly run on CI.
 *
 * CI gets a Postgres service and the Prisma migrations, so it has the real
 * *schema* — but not the data. The restored production database is 60 real
 * people's names, emails, leagues and drafts, and it is not going into a
 * GitHub runner. The contract tests read that data directly (`findById(1)` is
 * expected to be *Arrival*), so they cannot pass against an empty schema and
 * are excluded here rather than weakened into something that would pass
 * anywhere.
 *
 * What still runs on CI is everything that either needs no database at all
 * (tokens, contrast, the OKLCH clamp, components) or seeds its own rows — and
 * that second group includes every security test in the project: the claim
 * rules, session resolution, webhook signature verification, the admin relink
 * guard, the `userId`/`year` scoping on the list writes and the ownership
 * scoping on the watchlist's three progress reads. Those are the ones a
 * regression would hurt most, and they run on every push.
 *
 * The excluded suites still run locally, and `npm run test` remains the full
 * suite. They are the pre-cutover gate (spec §13), not dead weight — see
 * `docs/PROGRESS.md` for how to restore the database.
 */
export default config([
  ...EXCLUDE,
  // Contract tests against restored production data. The extglob spares
  // the two files that seed every row they touch — the `userId`/`year`
  // scoping on the list writes and the ownership scoping on the
  // watchlist's progress reads are security claims and belong on every
  // push.
  'lib/repositories/!(lists.writes|watchlists.scoping).test.ts',
  'lib/schema.test.ts',
  'lib/services/clerk-identity.production.test.ts',
  // Asserts the local Docker connection string (port 5433) and the
  // restored row counts — it is a check on the developer's environment,
  // which is exactly what CI is not.
  'lib/db.test.ts',
  // Services that read the restored data: the active season (2026 is
  // flagged in the real table) and the dashboard (league 1 is the only
  // league that has ever existed). The *pure* scoring rule is deliberately
  // NOT here — it was split into scoring.test.ts, which needs no database,
  // so the most consequential logic in the app is covered on every push.
  'lib/services/season.test.ts',
  'lib/services/dashboard.test.ts',
  'lib/services/scoring.production.test.ts',
  // The draft board and the owner's console, both read against league 1's
  // 2026 season — 4 groups of 4 seats, 3 of them dummies. The *rules* they
  // are built on run here: `draft-order.test.ts` (the snake, and the seat
  // that missed its turn) and `draft-actions.test.ts` (every refusal) seed
  // their own rows and need no restored data.
  'lib/services/draft.test.ts',
  'lib/services/draft-console.test.ts',
  // The live page, read against the real Oscars row and its 2025 season —
  // it asserts the show resolved and that its category count is over
  // twenty, which is what a restored season looks like and what an empty
  // schema cannot be. Its own docstring says "against the real restored
  // data"; excluded rather than weakened, like the rest of this list. The
  // composition it pins has no scoring of its own (D19/D41), and the rule
  // underneath runs here in `scoring.test.ts` on every push.
  'lib/services/live.test.ts',
  // Local film search, against the restored 1,355 titles. The ranking rule
  // it rests on — every context, the dedupe, the stability guarantee — is
  // `search-ranking.test.ts`, which needs no database and runs here.
  'lib/services/search.test.ts',
  // The award show page, read against the real 12 shows and 4,559
  // nominations — including the assertion that its point values agree with
  // what scoring awards. That check is only meaningful against real
  // `awards.points` foreign keys, which is why it lives here.
  'lib/services/award-show.test.ts',
  // Film ingest, which reads film 1 from the restored data to prove a
  // cached film is returned without asking TMDB.
  'lib/services/film-ingest.test.ts',
  // The film page's scoring panel: La La Land's 335 points and the five
  // picks behind its average draft position are restored rows. The cases
  // that need no data — an un-ingested film, and every way OMDb or TMDB
  // can fail — stayed in film.test.ts and run here.
  'lib/services/film.production.test.ts',
  // The watchlist, read against the restored corpus: the four captured
  // responses are user 3's own 2025 season, and the show-by-show totals
  // are only meaningful against the real 529 nominations behind them. The
  // shaping above the repository — grouping, the two totals, the ordering
  // — is `watchlist.test.ts`, which mocks the repositories and runs here.
  'lib/services/watchlist.production.test.ts',
  // The 125 restored feed rows, including the 89 written in the legacy
  // double-escaped spelling (trap 6). The scoping and ordering rules above
  // the repository are `lib/services/profile.test.ts` and
  // `actions/profile/feed-actions.test.ts`, which seed every row they touch
  // and run here.
  'lib/services/profile.production.test.ts',
  // The sitemap's film list, which is only non-empty against the restored
  // 1,355 titles. The privacy guard that shares the route — no league,
  // member, auth or admin URL may ever be published — is `sitemap.test.ts`,
  // which holds on an empty database and runs here.
  'app/sitemap.production.test.ts',
  // The worked example on /how-it-works, read against the restored season: it
  // asserts agreement with the real leaderboard — the top row of league 1's
  // scored season, its `nominations`/`winners`/`awards.points` rows and the
  // film's own title and poster path. CI has the schema and none of them, so
  // `getWorkedExample` correctly returns null there. The season-walk and
  // selection rules are `how-it-works.test.ts`, which mocks the repositories
  // and runs on every push.
  'lib/services/how-it-works.production.test.ts',
  // Query-count guards, measured against the restored corpus — a season of
  // real nominations is what makes "one film costs the same as 123"
  // meaningful.
  'lib/services/scoring.batching.test.ts',
]);
